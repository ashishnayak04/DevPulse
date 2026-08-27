import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldOff,
  Copy,
  Check,
  MonitorSmartphone,
  LogOut,
  Download,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { api } from '../../api';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { RelativeTime } from '../RelativeTime';
import { formatDate, copyToClipboard } from '../../utils/helpers';
import '../../styles/security.css';

const BROWSER_HINTS = [
  ['Edg/', 'Edge'],
  ['OPR/', 'Opera'],
  ['Firefox/', 'Firefox'],
  ['Chrome/', 'Chrome'],
  ['Safari/', 'Safari'],
  ['curl/', 'curl'],
];

const OS_HINTS = [
  ['Windows', 'Windows'],
  ['Mac OS X', 'macOS'],
  ['Macintosh', 'macOS'],
  ['Android', 'Android'],
  ['iPhone', 'iPhone'],
  ['iPad', 'iPad'],
  ['CrOS', 'ChromeOS'],
  ['Linux', 'Linux'],
];

// Naive UA parsing — enough to label a session list, nothing more.
function parseUserAgent(ua) {
  if (!ua) return 'Unknown device';

  const browser = (BROWSER_HINTS.find(([token]) => ua.includes(token)) || [])[1] || 'Browser';
  const os = (OS_HINTS.find(([token]) => ua.includes(token)) || [])[1];

  return os ? `${browser} · ${os}` : browser;
}

export const SecuritySection = () => {
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();

  // ── Active sessions ──
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  // ── TOTP wizard ──
  const [totpOpen, setTotpOpen] = useState(false);
  const [totpStep, setTotpStep] = useState('setup'); // 'setup' | 'backup'
  const [setup, setSetup] = useState(null); // { secret, otpauth_url, qr_data_url }
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // ── Disable TOTP ──
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling, setDisabling] = useState(false);

  // ── Danger zone ──
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteUsername, setDeleteUsername] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const data = await api.get('/auth/sessions');
      setSessions(data?.items || []);
    } catch (err) {
      addToast(err.message || 'Failed to load sessions', 'error');
    } finally {
      setLoadingSessions(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // ── Enable TOTP flow ──

  const openTotpWizard = async () => {
    setTotpOpen(true);
    setTotpStep('setup');
    setSetup(null);
    setVerifyCode('');
    setBackupCodes([]);
    try {
      setSetup(await api.post('/auth/totp/setup'));
    } catch (err) {
      addToast(err.message || 'Failed to start setup', 'error');
      setTotpOpen(false);
    }
  };

  const confirmTotp = async (e) => {
    e.preventDefault();
    if (!setup || verifyCode.length !== 6) return;
    setVerifying(true);
    try {
      const result = await api.post('/auth/totp/verify', { token: verifyCode, secret: setup.secret });
      setBackupCodes(result.backupCodes || []);
      setTotpStep('backup');
    } catch (err) {
      addToast(err.message || 'Invalid code. Please try again.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const finishTotp = () => {
    updateUser({ totpEnabled: true });
    setTotpOpen(false);
    addToast('Two-factor authentication enabled', 'success');
  };

  const copySecret = async () => {
    if (!setup) return;
    if (await copyToClipboard(setup.secret)) {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      addToast('Could not copy secret', 'error');
    }
  };

  const copyBackupCodes = async () => {
    if (await copyToClipboard(backupCodes.join('\n'))) {
      setCopiedCodes(true);
      addToast('Backup codes copied', 'success');
      setTimeout(() => setCopiedCodes(false), 2000);
    } else {
      addToast('Could not copy codes', 'error');
    }
  };

  // ── Disable TOTP flow ──

  const submitDisable = async (e) => {
    e.preventDefault();
    setDisabling(true);
    try {
      await api.post('/auth/totp/disable', {
        password: disablePassword || undefined,
        confirm: !disablePassword,
      });
      updateUser({ totpEnabled: false });
      setDisableOpen(false);
      setDisablePassword('');
      addToast('Two-factor authentication disabled', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to disable two-factor authentication', 'error');
    } finally {
      setDisabling(false);
    }
  };

  // ── Session actions ──

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api.delete(`/auth/sessions/${revokeTarget.id}`);
      addToast('Session revoked', 'success');
      setRevokeTarget(null);
      loadSessions();
    } catch (err) {
      addToast(err.message || 'Failed to revoke session', 'error');
    } finally {
      setRevoking(false);
    }
  };

  const signOutOtherSessions = async () => {
    setSigningOutAll(true);
    try {
      const result = await api.delete('/auth/sessions');
      const n = result?.revoked ?? 0;
      addToast(n > 0 ? `Signed out ${n} other session${n === 1 ? '' : 's'}` : 'No other active sessions', 'success');
      loadSessions();
    } catch (err) {
      addToast(err.message || 'Failed to sign out other sessions', 'error');
    } finally {
      setSigningOutAll(false);
    }
  };

  // ── Danger zone ──

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await api.request('/auth/export', {
        method: 'GET',
        headers: { Accept: 'application/octet-stream' },
      });
      if (res instanceof Blob) {
        const url = URL.createObjectURL(res);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'devpulse-export.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
      addToast('Your data export has been downloaded', 'success');
    } catch (err) {
      addToast(err.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const usernameMatches =
    deleteUsername.trim().toLowerCase() === (user?.username || '').trim().toLowerCase();

  const canDeleteAccount = deletePassword.length > 0 && usernameMatches;

  const deleteAccount = async () => {
    if (!canDeleteAccount) return;
    setDeleting(true);
    try {
      await api.delete('/auth/account', { password: deletePassword });
      localStorage.removeItem('accessToken');
      window.location.href = '/';
    } catch (err) {
      addToast(err.message || 'Failed to delete account', 'error');
      setDeleting(false);
    }
  };

  const othersCount = sessions.filter((s) => !s.current).length;

  return (
    <>
      {/* ── Two-Factor Authentication ─────────────────── */}
      <div className="settings-section">
        <div className="settings-section__head">
          <ShieldCheck size={16} />
          <div>
            <h2 className="settings-section__title">Two-Factor Authentication</h2>
            <p className="settings-section__desc">
              Require a one-time code from an authenticator app when signing in.
            </p>
          </div>
          {!user?.totpEnabled && (
            <Button size="sm" onClick={openTotpWizard}>
              Enable Two-Factor Authentication
            </Button>
          )}
        </div>

        <Card style={{ overflow: 'hidden' }}>
          <div className="sec-2fa-status">
            <div className="sec-2fa-status__info">
              {user?.totpEnabled ? (
                <>
                  <Badge tone="up" dot>2FA Enabled</Badge>
                  <span className="sec-2fa-status__hint">
                    A code from your authenticator app is required at sign-in.
                  </span>
                </>
              ) : (
                <>
                  <Badge tone="neutral">Not enabled</Badge>
                  <span className="sec-2fa-status__hint">
                    Your account is protected by password only.
                  </span>
                </>
              )}
            </div>
            {user?.totpEnabled && (
              <Button
                variant="ghost"
                size="sm"
                className="btn--danger-ghost"
                onClick={() => {
                  setDisablePassword('');
                  setDisableOpen(true);
                }}
              >
                <ShieldOff size={14} />
                Disable
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* ── Active Sessions ───────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section__head">
          <MonitorSmartphone size={16} />
          <div>
            <h2 className="settings-section__title">Active Sessions</h2>
            <p className="settings-section__desc">
              Devices currently signed in with your refresh token. Revoking one forces it to sign in again.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={signOutOtherSessions}
            loading={signingOutAll}
            disabled={othersCount === 0}
          >
            <LogOut size={13} />
            Sign out all other sessions
          </Button>
        </div>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {loadingSessions ? (
            <div className="sec-sessions-toolbar">
              <span className="sec-sessions-toolbar__meta">Loading sessions…</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="sec-sessions-toolbar">
              <span className="sec-sessions-toolbar__meta">No active sessions found.</span>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`sec-session-row ${session.current ? 'sec-session-row--current' : ''}`}
              >
                <span className="sec-session-row__icon">
                  <MonitorSmartphone size={16} />
                </span>
                <div className="sec-session-row__main">
                  <div className="sec-session-row__device">{parseUserAgent(session.userAgent)}</div>
                  <div className="sec-session-row__meta">
                    <span>{session.ipAddress || 'Unknown IP'}</span>
                    <span className="sec-session-row__dot" aria-hidden="true"></span>
                    <span>Created {formatDate(session.createdAt)}</span>
                    <span className="sec-session-row__dot" aria-hidden="true"></span>
                    <span>
                      Active <RelativeTime time={session.lastUsed} />
                    </span>
                  </div>
                </div>
                <div className="sec-session-row__actions">
                  {session.current ? (
                    <Badge tone="up">Current</Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="btn--danger-ghost"
                      onClick={() => setRevokeTarget(session)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* ── Danger Zone ───────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section__head">
          <AlertTriangle size={16} style={{ color: 'var(--danger-text)' }} />
          <div>
            <h2 className="settings-section__title">Danger Zone</h2>
            <p className="settings-section__desc">
              Export everything we store about you, or delete your account for good.
            </p>
          </div>
        </div>

        <Card className="sec-danger-card" style={{ overflow: 'hidden' }}>
          <div className="sec-danger-row">
            <div>
              <div className="sec-danger-row__title">
                <Download size={15} />
                Export My Data
              </div>
              <div className="sec-danger-row__desc">
                Download a machine-readable copy of your account, endpoints, and monitoring history.
              </div>
            </div>
            <Button variant="secondary" onClick={exportData} loading={exporting}>
              Export My Data
            </Button>
          </div>

          <div className="sec-danger-row">
            <div>
              <div className="sec-danger-row__title">
                <Trash2 size={15} />
                Delete Account
              </div>
              <div className="sec-danger-row__desc">
                Permanently remove your account and all associated data. This cannot be undone.
              </div>
            </div>
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              Delete Account
            </Button>
          </div>
        </Card>
      </div>

      {/* ── TOTP enablement wizard ────────────────────── */}
      <Modal
        isOpen={totpOpen}
        onClose={() => setTotpOpen(false)}
        icon={ShieldCheck}
        title="Enable Two-Factor Authentication"
        subtitle={
          totpStep === 'setup'
            ? 'Step 1 of 2 · Add DevPulse to your authenticator app'
            : 'Step 2 of 2 · Save your backup codes'
        }
      >
        {totpStep === 'setup' && (
          <form onSubmit={confirmTotp} className="sec-setup">
            {!setup ? (
              <p className="sec-setup__note">Generating your QR code…</p>
            ) : (
              <>
                <div className="sec-setup__qrwrap">
                  <img src={setup.qr_data_url} alt="Two-factor authentication QR code" className="sec-setup__qr" />
                </div>
                <p className="sec-setup__note">
                  Scan with Google Authenticator/Authy, or paste the secret into your app manually.
                </p>
                <div className="sec-secret-row">
                  <code className="sec-secret">{setup.secret}</code>
                  <Button type="button" variant="secondary" size="sm" onClick={copySecret}>
                    {copiedSecret ? <Check size={14} /> : <Copy size={14} />}
                    {copiedSecret ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <Input
                  label="Verification code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  autoFocus
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  hint="Enter the 6-digit code shown in your authenticator app."
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <Button type="button" variant="secondary" onClick={() => setTotpOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={verifying} disabled={verifyCode.length !== 6}>
                    Confirm
                  </Button>
                </div>
              </>
            )}
          </form>
        )}

        {totpStep === 'backup' && (
          <div className="sec-setup">
            <p className="sec-codes-warning">
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              Save these now — they won't be shown again
            </p>
            <div className="sec-codes">
              {backupCodes.map((code) => (
                <span key={code} className="sec-codes__item">{code}</span>
              ))}
            </div>
            <p className="sec-setup__note">
              Each backup code works once if you lose access to your authenticator app.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={copyBackupCodes}>
                {copiedCodes ? <Check size={14} /> : <Copy size={14} />}
                {copiedCodes ? 'Copied' : 'Copy all'}
              </Button>
              <Button onClick={finishTotp}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Disable TOTP (password or confirm) ────────── */}
      <Modal isOpen={disableOpen} onClose={() => setDisableOpen(false)} variant="center" ariaLabel="Disable two-factor authentication">
        <form onSubmit={submitDisable} style={{ padding: 4 }}>
          <div className="confirm-icon">
            <ShieldOff size={22} />
          </div>
          <h2 className="confirm-title">Disable two-factor authentication?</h2>
          <p className="confirm-desc">
            Your account will again rely on your password alone at sign-in.
          </p>
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            hint="Leave empty if you signed up with Google or GitHub."
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button type="button" variant="secondary" onClick={() => setDisableOpen(false)} disabled={disabling}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={disabling}>
              Disable 2FA
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Revoke single session ─────────────────────── */}
      <ConfirmDialog
        isOpen={!!revokeTarget}
        title="Revoke this session?"
        description={
          revokeTarget
            ? `"${parseUserAgent(revokeTarget.userAgent)}" will be signed out and must log in again.`
            : ''
        }
        confirmLabel="Revoke session"
        onClose={() => setRevokeTarget(null)}
        onConfirm={confirmRevoke}
        loading={revoking}
      />

      {/* ── Delete account ────────────────────────────── */}
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} variant="center" ariaLabel="Delete account">
        <form onSubmit={(e) => e.preventDefault()} style={{ padding: 4 }} className="sec-delete-modal">
          <div className="confirm-icon">
            <Trash2 size={22} />
          </div>
          <h2 className="confirm-title">Delete account?</h2>
          <p className="sec-delete-warning">
            This permanently deletes your account, all endpoints, monitoring history, and alerts. This cannot be undone.
          </p>
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
          />
          <Input
            label={`Type your username (${user?.username || ''}) to confirm`}
            type="text"
            placeholder={user?.username || ''}
            value={deleteUsername}
            onChange={(e) => setDeleteUsername(e.target.value)}
            error={deleteUsername && !usernameMatches ? 'Username does not match' : ''}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={deleting}
              disabled={!canDeleteAccount}
              onClick={deleteAccount}
            >
              Delete My Account
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default SecuritySection;
