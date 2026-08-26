const crypto = require('crypto');
const prisma = require('../../lib/prisma');
const HttpError = require('../../lib/http-error');
const logger = require('../../lib/logger');
const { recordAudit } = require('../../lib/audit');
const { sendAlertEmail } = require('../../services/email.service');
const { escapeHtml } = require('../../utils/sanitize');

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MANAGE_ROLES = ['OWNER', 'ADMIN'];

// ─── Guards ──────────────────────────────────────────────

async function getTeamAndMembership(slug, user) {
  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) {
    throw new HttpError('Team not found', { statusCode: 404, code: 'TEAM_NOT_FOUND' });
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: user.id } },
  });
  if (!membership) {
    throw new HttpError('You are not a member of this team', { statusCode: 403, code: 'FORBIDDEN' });
  }

  return { team, membership };
}

function assertCanManage(membership) {
  if (!MANAGE_ROLES.includes(membership.role)) {
    throw new HttpError('Only team owners and admins can perform this action', {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }
}

function assertOwner(membership) {
  if (membership.role !== 'OWNER') {
    throw new HttpError('Only the team owner can perform this action', {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }
}

// ─── Teams ───────────────────────────────────────────────

async function createTeam(user, data) {
  const existing = await prisma.team.findUnique({ where: { slug: data.slug } });
  if (existing) {
    throw new HttpError(`The slug "${data.slug}" is already taken`, { statusCode: 409, code: 'SLUG_TAKEN' });
  }

  const team = await prisma.team.create({
    data: {
      name: data.name,
      slug: data.slug,
      members: { create: { userId: user.id, role: 'OWNER' } },
    },
    select: { id: true, name: true, slug: true },
  });

  return { team, membership: { role: 'OWNER' } };
}

async function listTeams(userId) {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: { select: { members: true, endpoints: true } },
        },
      },
    },
  });

  return {
    items: memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      slug: m.team.slug,
      role: m.role,
      memberCount: m.team._count.members,
      endpointCount: m.team._count.endpoints,
      createdAt: m.team.createdAt,
    })),
  };
}

async function renameTeam(slug, user, data) {
  const { team, membership } = await getTeamAndMembership(slug, user);
  assertCanManage(membership);

  return prisma.team.update({
    where: { id: team.id },
    data: { name: data.name },
    select: { id: true, name: true, slug: true },
  });
}

async function deleteTeam(slug, user) {
  const { team, membership } = await getTeamAndMembership(slug, user);
  assertOwner(membership);

  await prisma.team.delete({ where: { id: team.id } });

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'team.delete',
    targetType: 'Team',
    targetId: team.id,
    metadata: { name: team.name, slug: team.slug },
  });

  return { message: `Team "${team.name}" deleted` };
}

// ─── Members ─────────────────────────────────────────────

async function listMembers(slug, user) {
  const { team } = await getTeamAndMembership(slug, user);

  const members = await prisma.teamMember.findMany({
    where: { teamId: team.id },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    include: { user: { select: { id: true, username: true, email: true } } },
  });

  return {
    items: members.map((m) => ({
      userId: m.user.id,
      username: m.user.username,
      email: m.user.email,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
  };
}

async function changeMemberRole(slug, targetUserId, user, data) {
  const { team, membership } = await getTeamAndMembership(slug, user);
  assertCanManage(membership);

  const target = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: targetUserId } },
  });
  if (!target) {
    throw new HttpError('Member not found', { statusCode: 404, code: 'MEMBER_NOT_FOUND' });
  }
  if (target.role === 'OWNER') {
    throw new HttpError('The team owner role cannot be changed. Delete the team to release ownership.', {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }

  const updated = await prisma.teamMember.update({
    where: { id: target.id },
    data: { role: data.role },
    select: { userId: true, role: true },
  });

  return { message: 'Role updated', ...updated };
}

async function removeMember(slug, targetUserId, user) {
  const { team, membership } = await getTeamAndMembership(slug, user);

  const target = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: team.id, userId: targetUserId } },
  });
  if (!target) {
    throw new HttpError('Member not found', { statusCode: 404, code: 'MEMBER_NOT_FOUND' });
  }

  const isSelf = target.userId === user.id;

  if (isSelf && target.role === 'OWNER') {
    throw new HttpError(
      'Owners cannot leave their own team. Transfer ownership or delete the team instead.',
      { statusCode: 400, code: 'OWNER_CANNOT_LEAVE' }
    );
  }

  if (target.role === 'OWNER') {
    throw new HttpError('The team owner cannot be removed', { statusCode: 403, code: 'FORBIDDEN' });
  }

  if (!isSelf) {
    assertCanManage(membership);
  }

  await prisma.teamMember.delete({ where: { id: target.id } });

  return { message: isSelf ? `You left "${team.name}"` : 'Member removed' };
}

// ─── Team detail ─────────────────────────────────────────

async function getTeamDetail(slug, user) {
  const { team, membership } = await getTeamAndMembership(slug, user);

  const [members, teamEndpoints] = await Promise.all([
    prisma.teamMember.findMany({
      where: { teamId: team.id },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      include: { user: { select: { id: true, username: true, email: true } } },
    }),
    prisma.teamEndpoint.findMany({
      where: { teamId: team.id },
      orderBy: { endpoint: { name: 'asc' } },
      include: {
        endpoint: { select: { id: true, name: true, url: true, status: true, isActive: true } },
      },
    }),
  ]);

  let invites = [];
  if (membership.role === 'OWNER' || membership.role === 'ADMIN') {
    invites = await prisma.teamInvite.findMany({
      where: { teamId: team.id, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
  }

  return {
    team: { id: team.id, name: team.name, slug: team.slug, createdAt: team.createdAt },
    myRole: membership.role,
    members: members.map((m) => ({
      userId: m.user.id,
      username: m.user.username,
      email: m.user.email,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    endpoints: teamEndpoints.map((te) => ({ ...te.endpoint })),
    invites,
  };
}

// ─── Invites ─────────────────────────────────────────────

async function listMyInvites(email) {
  const invites = await prisma.teamInvite.findMany({
    where: { email: { equals: email, mode: 'insensitive' }, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'asc' },
    include: { team: { select: { name: true, slug: true } } },
  });

  return {
    items: invites.map((i) => ({
      id: i.id,
      token: i.token,
      teamName: i.team.name,
      teamSlug: i.team.slug,
      role: i.role,
      expiresAt: i.expiresAt,
    })),
  };
}

async function acceptInvite(token, user) {
  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: { team: { select: { name: true, slug: true } } },
  });
  if (!invite) {
    throw new HttpError('Invalid or unknown invitation', { statusCode: 404, code: 'INVITE_NOT_FOUND' });
  }

  if (invite.expiresAt <= new Date()) {
    await prisma.teamInvite.delete({ where: { id: invite.id } }).catch(() => {});
    throw new HttpError('This invitation has expired', { statusCode: 400, code: 'INVITE_EXPIRED' });
  }

  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: invite.teamId, userId: user.id } },
  });
  if (!existing) {
    await prisma.teamMember.create({
      data: { teamId: invite.teamId, userId: user.id, role: invite.role },
    });
  }

  await prisma.teamInvite.delete({ where: { id: invite.id } });

  return { team: invite.team };
}

async function inviteMember(slug, user, data, origin) {
  const { team, membership } = await getTeamAndMembership(slug, user);
  assertCanManage(membership);

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: data.email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existingUser) {
    const alreadyMember = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: team.id, userId: existingUser.id } },
    });
    if (alreadyMember) {
      throw new HttpError(`${data.email} is already a member of this team`, {
        statusCode: 409,
        code: 'ALREADY_MEMBER',
      });
    }
  }

  let invite = await prisma.teamInvite.findFirst({
    where: {
      teamId: team.id,
      email: { equals: data.email, mode: 'insensitive' },
      expiresAt: { gt: new Date() },
    },
  });

  if (invite) {
    invite = await prisma.teamInvite.update({
      where: { id: invite.id },
      data: { role: data.role, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
    });
  } else {
    invite = await prisma.teamInvite.create({
      data: {
        teamId: team.id,
        email: data.email,
        role: data.role,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
  }

  // Fire-and-forget so the HTTP request returns immediately
  sendTeamInviteEmail({
    to: data.email,
    teamName: team.name,
    role: data.role,
    token: invite.token,
    origin,
  }).catch((err) => {
    logger.warn('Teams', `Failed to send invite email to ${data.email}: ${err.message}`);
  });

  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
  };
}

function buildInviteEmailHtml({ teamName, role, appUrl, acceptUrl }) {
  const safeTeam = escapeHtml(teamName);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevPulse Invite</title>
</head>
<body style="margin:0;padding:0;background-color:#080b1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080b1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="
                    width:48px;height:48px;border-radius:14px;
                    background:linear-gradient(135deg,#8b5cf6,#06b6d4);
                    font-size:22px;line-height:48px;text-align:center;
                  ">
                    <span style="color:#fff;">&#9889;</span>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:20px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px;">
                Dev<span style="background:linear-gradient(135deg,#8b5cf6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Pulse</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="
              background:rgba(255,255,255,0.03);
              backdrop-filter:blur(20px);
              border-radius:16px;
              border:1px solid rgba(255,255,255,0.06);
              padding:40px 36px;
            ">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <span style="font-size:48px;line-height:1;">&#128230;</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#f1f5f9;letter-spacing:-0.5px;">
                      You're invited
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <p style="margin:0;font-size:14px;color:#94a3b8;line-height:22px;">
                      You've been invited to join <strong style="color:#f1f5f9;">${safeTeam}</strong>
                      as a <strong style="color:#6fe0f4;">${role}</strong> on DevPulse.
                      Log in with this email address and click below to accept.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <table cellpadding="0" cellspacing="0" align="center">
                      <tr>
                        <td align="center" style="
                          background:linear-gradient(135deg,#8b5cf6,#06b6d4);
                          border-radius:10px;
                          padding:14px 32px;
                        ">
                          <a href="${appUrl}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:block;">
                            Accept Invitation
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <p style="margin:0;font-size:12px;color:#64748b;line-height:18px;">
                      Or copy this direct link into your browser:<br>
                      <a href="${acceptUrl}" style="color:#8b5cf6;text-decoration:none;word-break:break-all;">${acceptUrl}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <p style="margin:0;font-size:12px;color:#64748b;">
                      This invitation expires in 7 days. If you weren't expecting it,
                      you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:32px;">
              <p style="margin:0;font-size:12px;color:#64748b;">
                Sent by <span style="font-weight:600;">DevPulse Monitoring</span>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#475569;">
                This is an automated message. Do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendTeamInviteEmail({ to, teamName, role, token, origin }) {
  const appUrl = `${origin}/teams?invite=${encodeURIComponent(token)}`;
  const acceptUrl = appUrl;

  await sendAlertEmail({
    to,
    subject: `You're invited to ${teamName} on DevPulse`,
    html: buildInviteEmailHtml({ teamName, role, appUrl, acceptUrl }),
  });
}

// ─── Endpoints ───────────────────────────────────────────

async function attachEndpoint(slug, user, data) {
  const { team, membership } = await getTeamAndMembership(slug, user);
  assertCanManage(membership);

  const endpoint = await prisma.endpoint.findFirst({
    where: { id: data.endpointId, userId: user.id },
    select: { id: true, name: true },
  });
  if (!endpoint) {
    throw new HttpError('Endpoint not found among your monitors', { statusCode: 404, code: 'ENDPOINT_NOT_FOUND' });
  }

  const existing = await prisma.teamEndpoint.findUnique({
    where: { teamId_endpointId: { teamId: team.id, endpointId: endpoint.id } },
  });
  if (existing) {
    throw new HttpError('This endpoint is already attached to the team', {
      statusCode: 409,
      code: 'ALREADY_ATTACHED',
    });
  }

  await prisma.teamEndpoint.create({
    data: { teamId: team.id, endpointId: endpoint.id },
  });

  return { message: `"${endpoint.name}" attached to ${team.name}`, endpointId: endpoint.id };
}

async function detachEndpoint(slug, endpointId, user) {
  const { team, membership } = await getTeamAndMembership(slug, user);
  assertCanManage(membership);

  const link = await prisma.teamEndpoint.findUnique({
    where: { teamId_endpointId: { teamId: team.id, endpointId } },
  });
  if (!link) {
    throw new HttpError('Endpoint is not attached to this team', { statusCode: 404, code: 'NOT_FOUND' });
  }

  await prisma.teamEndpoint.delete({
    where: { teamId_endpointId: { teamId: team.id, endpointId } },
  });

  return { message: 'Endpoint detached' };
}

module.exports = {
  createTeam,
  listTeams,
  renameTeam,
  deleteTeam,
  listMembers,
  changeMemberRole,
  removeMember,
  getTeamDetail,
  listMyInvites,
  acceptInvite,
  inviteMember,
  attachEndpoint,
  detachEndpoint,
};
