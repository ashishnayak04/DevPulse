const teamService = require('./team.service');

async function create(req, res, next) {
  try {
    const result = await teamService.createTeam(req.user, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const data = await teamService.listTeams(req.user.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function myInvites(req, res, next) {
  try {
    const data = await teamService.listMyInvites(req.user.email);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function acceptInvite(req, res, next) {
  try {
    const data = await teamService.acceptInvite(req.query.token, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function detail(req, res, next) {
  try {
    const data = await teamService.getTeamDetail(req.params.slug, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function rename(req, res, next) {
  try {
    const data = await teamService.renameTeam(req.params.slug, req.user, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const data = await teamService.deleteTeam(req.params.slug, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function members(req, res, next) {
  try {
    const data = await teamService.listMembers(req.params.slug, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function changeRole(req, res, next) {
  try {
    const data = await teamService.changeMemberRole(req.params.slug, req.params.userId, req.user, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function removeMember(req, res, next) {
  try {
    const data = await teamService.removeMember(req.params.slug, req.params.userId, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function invite(req, res, next) {
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const data = await teamService.inviteMember(req.params.slug, req.user, req.body, origin);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function attachEndpoint(req, res, next) {
  try {
    const data = await teamService.attachEndpoint(req.params.slug, req.user, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function detachEndpoint(req, res, next) {
  try {
    const data = await teamService.detachEndpoint(req.params.slug, req.params.endpointId, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  list,
  myInvites,
  acceptInvite,
  detail,
  rename,
  remove,
  members,
  changeRole,
  removeMember,
  invite,
  attachEndpoint,
  detachEndpoint,
};
