import React, { useEffect, useMemo, useState } from 'react';
import { Mail, KeyRound, Moon, Send, ExternalLink } from 'lucide-react';
import { api } from '../../api';
import { useToast } from '../Toast';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { Skeleton } from '../ui/Skeleton';
import '../../styles/notifications.css';

function buildTimezoneOptions() {
  let zones = ['UTC'];
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      zones = Intl.supportedValuesOf('timeZone');
    }
  } catch {
    zones = ['UTC'];
  }
  const rest = zones.filter((z) => z !== 'UTC').sort();
  return ['UTC', ...rest];
}

const TIMEZONE_OPTIONS = buildTimezoneOptions();
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${String(h).padStart(2, '0')}:00`,
}));

function normalizePrefs(prefs = {}) {
  return {
    emailEnabled: prefs.emailEnabled !== false,
    emailOnDown: prefs.emailOnDown !== false,
    emailOnRecovery: prefs.emailOnRecovery !== false,
    pagerdutyEnabled: prefs.pagerdutyEnabled === true,
    pagerdutyKey: typeof prefs.pagerdutyKey === 'string' ? prefs.pagerdutyKey : '',
    quietHoursEnabled: prefs.quietHoursEnabled === true,
    quietHoursStart:
      prefs.quietHoursStart === null || prefs.quietHoursStart === undefined
        ? ''
        : String(prefs.quietHoursStart),
    quietHoursEnd:
      prefs.quietHoursEnd === null || prefs.quietHoursEnd === undefined
        ? ''
        : String(prefs.quietHoursEnd),
    timezone: prefs.timezone || 'UTC',
  };
}

function buildPayload(form) {
  const start = form.quietHoursStart === '' ? null : Number(form.quietHoursStart);
  const end = form.quietHoursEnd === '' ? null : Number(form.quietHoursEnd);
  return {
    emailEnabled: form.emailEnabled,
    emailOnDown: form.emailOnDown,
    emailOnRecovery: form.emailOnRecovery,
    pagerdutyEnabled: form.pagerdutyEnabled,
    pagerdutyKey: form.pagerdutyKey.trim() ? form.pagerdutyKey.trim() : null,
    quietHoursEnabled: form.quietHoursEnabled,
    quietHoursStart: start,
    quietHoursEnd: end,
    timezone: form.timezone,
  };
}

const Switch = ({ checked, onChange, disabled, label }) => (
  <label className={`np-switch ${disabled ? 'np-switch--disabled' : ''}`.trim()}>
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={label}
    />
    <span className="np-switch__slider" aria-hidden="true" />
  </label>
);

const ToggleRow = ({ muted, label, desc, children }) => (
  <div className={`np-row ${muted ? 'np-row--muted' : ''}`.trim()}>
    <div className="np-row__text">
      <span className="np-row__label">{label}</span>
      {desc && <span className="np-row__desc">{desc}</span>}
    </div>
    {children}
  </div>
);

export const NotificationsSection = () => {
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get('/notifications/preferences');
        if (!cancelled) {
          const normalized = normalizePrefs(data?.prefs);
          setSaved(normalized);
          setForm(normalized);
        }
      } catch (err) {
        if (!cancelled) addToast(err.message || 'Failed to load notification preferences', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const isDirty = useMemo(
    () => !!form && !!saved && JSON.stringify(form) !== JSON.stringify(saved),
    [form, saved]
  );

  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const toggleQuietHours = (e) => {
    const enabled = e.target.checked;
    setForm((f) => ({
      ...f,
      quietHoursEnabled: enabled,
      quietHoursStart: f.quietHoursStart === '' ? '22' : f.quietHoursStart,
      quietHoursEnd: f.quietHoursEnd === '' ? '6' : f.quietHoursEnd,
    }));
  };

  const savePreferences = async (e) => {
    e.preventDefault();
    if (!isDirty) return;

    const payload = buildPayload(form);
    const pairMismatch =
      (payload.quietHoursStart === null) !== (payload.quietHoursEnd === null);
    if (pairMismatch) {
      addToast('Set both quiet-hours bounds, or clear both', 'error');
      return;
    }

    setSaving(true);
    try {
      const data = await api.patch('/notifications/preferences', payload);
      const normalized = normalizePrefs(data?.prefs);
      setSaved(normalized);
      setForm(normalized);
      addToast('Preferences saved', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to save preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendPagerdutyTest = async () => {
    if (isDirty) {
      addToast('Save your preferences before sending a test event', 'info');
      return;
    }
    setTesting(true);
    try {
      await api.post('/notifications/pagerduty/test');
      addToast('Test event sent to PagerDuty', 'success');
    } catch (err) {
      addToast(err.message || 'PagerDuty test failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="np">
        {[0, 1, 2].map((i) => (
          <div className="settings-section" key={i}>
            <Card style={{ padding: 20 }}>
              <Skeleton width={180} height={14} style={{ marginBottom: 14 }} />
              <Skeleton width="100%" height={38} radius={8} style={{ marginBottom: 10 }} />
              <Skeleton width="100%" height={38} radius={8} style={{ marginBottom: 10 }} />
              <Skeleton width="60%" height={38} radius={8} />
            </Card>
          </div>
        ))}
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="np">
      <form onSubmit={savePreferences}>
        <div className="settings-section">
          <div className="settings-section__head">
            <Mail size={16} />
            <div>
              <h2 className="settings-section__title">Email alerts</h2>
              <p className="settings-section__desc">
                Alert emails are sent to your account address whenever an endpoint changes state.
              </p>
            </div>
          </div>
          <Card style={{ padding: 8 }}>
            <ToggleRow
              label="Email alerts"
              desc="Master switch for all alert emails"
            >
              <Switch
                label="Email alerts"
                checked={form.emailEnabled}
                onChange={(e) => setField('emailEnabled', e.target.checked)}
              />
            </ToggleRow>
            <ToggleRow
              muted={!form.emailEnabled}
              label="Email me when an endpoint goes DOWN"
            >
              <Switch
                label="Email me when an endpoint goes DOWN"
                checked={form.emailOnDown}
                disabled={!form.emailEnabled}
                onChange={(e) => setField('emailOnDown', e.target.checked)}
              />
            </ToggleRow>
            <ToggleRow
              muted={!form.emailEnabled}
              label="Email me on recovery"
            >
              <Switch
                label="Email me on recovery"
                checked={form.emailOnRecovery}
                disabled={!form.emailEnabled}
                onChange={(e) => setField('emailOnRecovery', e.target.checked)}
              />
            </ToggleRow>
          </Card>
        </div>

        <div className="settings-section">
          <div className="settings-section__head">
            <KeyRound size={16} />
            <div>
              <h2 className="settings-section__title">PagerDuty</h2>
              <p className="settings-section__desc">
                Trigger critical incidents in PagerDuty when an endpoint goes down or its SSL
                certificate nears expiry. Recoveries resolve the incident automatically.
              </p>
            </div>
          </div>
          <Card style={{ padding: 20 }}>
            <ToggleRow label="Enable PagerDuty events">
              <Switch
                label="Enable PagerDuty events"
                checked={form.pagerdutyEnabled}
                onChange={(e) => setField('pagerdutyEnabled', e.target.checked)}
              />
            </ToggleRow>

            <Input
              label="Integration Key"
              type="password"
              autoComplete="off"
              placeholder="Your Events API v2 routing key"
              value={form.pagerdutyKey}
              onChange={(e) => setField('pagerdutyKey', e.target.value)}
              disabled={!form.pagerdutyEnabled}
              hint="Find it under your PagerDuty service → Integrations → Events API v2."
            />

            <div className="np-pd-actions">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={testing}
                disabled={!form.pagerdutyEnabled || !form.pagerdutyKey.trim()}
                onClick={sendPagerdutyTest}
              >
                {!testing && <Send size={13} />}
                Send test event
              </Button>
              <a
                className="np-docs-link"
                href="https://developer.pagerduty.com/docs/events-api-v2"
                target="_blank"
                rel="noopener noreferrer"
              >
                Events API v2 docs
                <ExternalLink size={12} />
              </a>
            </div>
          </Card>
        </div>

        <div className="settings-section">
          <div className="settings-section__head">
            <Moon size={16} />
            <div>
              <h2 className="settings-section__title">Quiet hours</h2>
              <p className="settings-section__desc">
                Alert emails are muted during these hours (PagerDuty still fires).
              </p>
            </div>
          </div>
          <Card style={{ padding: 20 }}>
            <ToggleRow label="Enable quiet hours">
              <Switch
                label="Enable quiet hours"
                checked={form.quietHoursEnabled}
                onChange={toggleQuietHours}
              />
            </ToggleRow>

            <div className="np-quiet-grid">
              <Select
                label="Starts at"
                value={form.quietHoursStart}
                onChange={(e) => setField('quietHoursStart', e.target.value)}
                disabled={!form.quietHoursEnabled}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </Select>
              <Select
                label="Ends at"
                value={form.quietHoursEnd}
                onChange={(e) => setField('quietHoursEnd', e.target.value)}
                disabled={!form.quietHoursEnabled}
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </Select>
            </div>

            <Select
              label="Timezone"
              value={form.timezone}
              onChange={(e) => setField('timezone', e.target.value)}
              disabled={!form.quietHoursEnabled}
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </Select>
          </Card>
        </div>

        <div className={`np-savebar ${isDirty ? 'np-savebar--active' : ''}`.trim()} aria-hidden={!isDirty}>
          <span className="np-savebar__hint">You have unsaved changes</span>
          <Button type="submit" loading={saving} disabled={!isDirty}>
            Save preferences
          </Button>
        </div>
      </form>
    </div>
  );
};

export default NotificationsSection;
