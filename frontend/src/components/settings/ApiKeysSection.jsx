import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, Key, Copy, Check, AlertTriangle } from 'lucide-react';
import { useToast } from '../Toast';
import { api } from '../../api';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { RelativeTime } from '../RelativeTime';
import { formatDate, copyToClipboard } from '../../utils/helpers';
import '../../styles/apikeys.css';

export const ApiKeysSection = () => {
  const { addToast } = useToast();

  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  const [genOpen, setGenOpen] = useState(false);
  const [genStep, setGenStep] = useState('form'); // 'form' | 'done'
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null); // { id, name, keyPrefix, createdAt, key }
  const [copied, setCopied] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/keys');
      setApiKeys(data?.items || []);
    } catch (err) {
      addToast(err.message || 'Failed to load API keys', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  // ── Generate flow ──

  const openGenerate = () => {
    setName('');
    setCreated(null);
    setCopied(false);
    setGenStep('form');
    setGenOpen(true);
  };

  const submitGenerate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const result = await api.post('/keys', { name: name.trim() });
      setCreated(result);
      setCopied(false);
      setGenStep('done');
    } catch (err) {
      addToast(err.message || 'Failed to generate API key', 'error');
    } finally {
      setCreating(false);
    }
  };

  const copyKey = async () => {
    if (!created) return;
    if (await copyToClipboard(created.key)) {
      setCopied(true);
      addToast('API key copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } else {
      addToast('Could not copy API key', 'error');
    }
  };

  const finishGenerate = () => {
    setGenOpen(false);
    loadKeys();
  };

  // ── Revoke flow ──

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api.delete(`/keys/${revokeTarget.id}`);
      addToast('API key revoked', 'success');
      setRevokeTarget(null);
      loadKeys();
    } catch (err) {
      addToast(err.message || 'Failed to revoke API key', 'error');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <>
      {/* ── API Keys ───────────────────────────────────── */}
      <div className="settings-section">
        <div className="settings-section__head">
          <KeyRound size={16} />
          <div>
            <h2 className="settings-section__title">API Keys</h2>
            <p className="settings-section__desc">
              Authenticate the DevPulse API with Bearer &lt;key&gt; for scripts &amp; CI.
            </p>
          </div>
          <Button size="sm" onClick={openGenerate}>
            <KeyRound size={13} />
            Generate API Key
          </Button>
        </div>

        <Card style={{ padding: loading || apiKeys.length === 0 ? undefined : 0, overflow: 'hidden' }}>
          {loading ? (
            <div className="ak-loading">
              <span className="spinner" aria-hidden="true" style={{ width: 18, height: 18 }} />
              Loading API keys…
            </div>
          ) : apiKeys.length === 0 ? (
            <EmptyState
              icon={Key}
              title="No API keys"
              description="Create a key to use the DevPulse API from scripts, cron jobs, or CI pipelines."
            />
          ) : (
            apiKeys.map((apiKey) => (
              <div className="ak-row" key={apiKey.id}>
                <span className="ak-row__icon">
                  <KeyRound size={16} />
                </span>
                <div className="ak-row__main">
                  <div className="ak-row__name">{apiKey.name}</div>
                  <div className="ak-row__meta">
                    <code className="ak-chip" title="Key prefix">{apiKey.keyPrefix}…</code>
                    <span>Created {formatDate(apiKey.createdAt)}</span>
                    <span className="ak-row__dot" aria-hidden="true"></span>
                    <span>
                      Last used{' '}
                      <RelativeTime time={apiKey.lastUsed} fallback="Never" />
                    </span>
                  </div>
                </div>
                <div className="ak-row__actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="btn--danger-ghost"
                    onClick={() => setRevokeTarget(apiKey)}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* ── Generate modal ─────────────────────────────── */}
      <Modal
        isOpen={genOpen}
        onClose={() => setGenOpen(false)}
        icon={KeyRound}
        title="Generate API Key"
        subtitle={genStep === 'form' ? 'Give the key a name so you can recognize it later.' : undefined}
      >
        {genStep === 'form' && (
          <form onSubmit={submitGenerate}>
            <Input
              label="Key name"
              placeholder="e.g. CI deploy script"
              maxLength={60}
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              hint="You'll see the full key only once, right after generating it."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button type="button" variant="secondary" onClick={() => setGenOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={creating}>
                Generate API Key
              </Button>
            </div>
          </form>
        )}

        {genStep === 'done' && created && (
          <div className="ak-done">
            <p className="ak-warning">
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              Copy this now — it won't be shown again
            </p>
            <div className="ak-key-row">
              <input
                className="ak-key-input"
                readOnly
                value={created.key}
                onFocus={(e) => e.target.select()}
                aria-label="Your new API key"
              />
              <Button type="button" variant="secondary" size="sm" onClick={copyKey}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={finishGenerate}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Revoke single key ──────────────────────────── */}
      <ConfirmDialog
        isOpen={!!revokeTarget}
        title="Revoke this API key?"
        description={
          revokeTarget
            ? `"${revokeTarget.name}" will stop working immediately. Anything using it will receive 401 responses.`
            : ''
        }
        confirmLabel="Revoke key"
        onClose={() => setRevokeTarget(null)}
        onConfirm={confirmRevoke}
        loading={revoking}
      />
    </>
  );
};

export default ApiKeysSection;
