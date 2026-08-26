import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  BellRing,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Clock,
  Edit3,
  ChevronDown,
  Webhook,
  Mail,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Input';
import '../styles/onboarding.css';

const STEPS = [
  { id: 1, label: 'Add monitor', icon: Activity },
  { id: 2, label: 'Alerts', icon: BellRing },
  { id: 3, label: 'Status page', icon: Share2 },
];

const INTERVAL_OPTIONS = [
  { value: 30000, label: 'Every 30 seconds' },
  { value: 60000, label: 'Every minute' },
  { value: 300000, label: 'Every 5 minutes' },
];

const WEBHOOK_TYPES = [
  { value: 'SLACK', label: 'Slack' },
  { value: 'DISCORD', label: 'Discord' },
  { value: 'GENERIC', label: 'Generic' },
];

const CONFETTI_COLORS = ['#22d3ee', '#34d399', '#f472b6', '#fbbf24', '#a78bfa'];

const CONFETTI_PIECES = Array.from({ length: 12 }, (_, i) => ({
  left: 3 + i * 8 + ((i * 37) % 6),
  delay: (i % 6) * 0.16,
  duration: 2.6 + (i % 4) * 0.45,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 7 + (i % 3) * 3,
}));

export const OnboardingWizard = () => {
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const cardRef = useRef(null);

  const [step, setStep] = useState(1);
  const [completing, setCompleting] = useState(false);

  // Step 1 — first monitor
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [intervalMs, setIntervalMs] = useState(60000);
  const [creating, setCreating] = useState(false);

  // Step 2 — webhook
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [webhookAdded, setWebhookAdded] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookType, setWebhookType] = useState('SLACK');
  const [addingWebhook, setAddingWebhook] = useState(false);

  // Step 3 — status page
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const finishOnboarding = useCallback(async () => {
    setCompleting(true);
    try {
      await api.patch('/auth/onboarding/complete');
      updateUser({ onboardingCompleted: true });
      return true;
    } catch (err) {
      addToast(err.message || 'Something went wrong. Please try again.', 'error');
      return false;
    } finally {
      setCompleting(false);
    }
  }, [updateUser, addToast]);

  const handleSkip = () => {
    finishOnboarding();
  };

  const handleStartMonitoring = async () => {
    const ok = await finishOnboarding();
    if (ok) {
      addToast('Setup complete. Monitoring started!', 'success');
    }
  };

  const handleCreateEndpoint = async (e) => {
    e.preventDefault();

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      addToast('URL must start with http:// or https://', 'error');
      return;
    }

    setCreating(true);
    try {
      await api.post('/endpoints', {
        name,
        url,
        intervalMs: parseInt(intervalMs, 10),
      });
      addToast(`Now monitoring ${name || url}`, 'success');
      setStep(2);
    } catch (err) {
      addToast(err.message || 'Failed to create monitor', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleAddWebhook = async (e) => {
    e.preventDefault();
    setAddingWebhook(true);
    try {
      await api.post('/webhooks', { url: webhookUrl.trim(), type: webhookType });
      addToast('Webhook added', 'success');
      setWebhookAdded(true);
      setWebhookOpen(false);
    } catch (err) {
      addToast(err.message || 'Failed to add webhook', 'error');
    } finally {
      setAddingWebhook(false);
    }
  };

  const statusUrl = `${window.location.origin}/status/${encodeURIComponent(user.username || '')}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(statusUrl);
      setCopied(true);
      addToast('Status page link copied', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      addToast('Could not copy link', 'error');
    }
  };

  const StepIcon = STEPS[step - 1].icon;
  const alertTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="obw-overlay animate-fade-in">
      {step === 3 && (
        <div className="obw-confetti" aria-hidden="true">
          {CONFETTI_PIECES.map((piece, i) => (
            <span
              key={i}
              className="obw-confetti__piece"
              style={{
                left: `${piece.left}%`,
                width: piece.size,
                height: piece.size * 1.6,
                background: piece.color,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
              }}
            />
          ))}
        </div>
      )}

      <div
        ref={cardRef}
        className="obw-card animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to DevPulse setup"
        tabIndex={-1}
      >
        <div className="obw-progress" aria-hidden="true">
          <span className="obw-progress__fill" style={{ width: `${(step / STEPS.length) * 100}%` }} />
        </div>

        <ol className="obw-steps">
          {STEPS.map((s) => (
            <li
              key={s.id}
              className={`obw-step ${step === s.id ? 'obw-step--active' : ''} ${
                step > s.id ? 'obw-step--done' : ''
              }`}
              aria-current={step === s.id ? 'step' : undefined}
            >
              <span className="obw-step__dot">{step > s.id ? <Check size={11} /> : s.id}</span>
              <span className="obw-step__label">{s.label}</span>
            </li>
          ))}
        </ol>

        <div className="obw-heading">
          <span className="obw-heading__icon">
            <StepIcon size={17} />
          </span>
          <h2 className="obw-heading__title">{
            step === 1
              ? 'Add your first monitor'
              : step === 2
                ? 'Get alerts when it goes down'
                : 'Share your status page'
          }</h2>
        </div>
        <p className="obw-heading__sub">
          {step === 1 && 'Point DevPulse at any URL and it starts checking immediately.'}
          {step === 2 && 'Choose where notifications should land when something breaks.'}
          {step === 3 && 'Your monitors get a public home. Share it with your users.'}
        </p>

        {step === 1 && (
          <form onSubmit={handleCreateEndpoint} className="obw-body">
            <Input
              label="Name"
              icon={Edit3}
              placeholder="e.g. Production API"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            <Input
              label="URL"
              icon={Globe}
              type="url"
              placeholder="https://api.example.com/health"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <Select
              label="Check interval"
              icon={Clock}
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
            >
              {INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <Button type="submit" block size="lg" loading={creating}>
              {creating ? 'Creating...' : 'Create monitor'}
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="obw-body">
            <div className="obw-mailrow">
              <Mail size={15} aria-hidden="true" />
              <span className="obw-mailrow__label">Alert email:</span>
              <span className="obw-mailrow__value">{user.email}</span>
            </div>

            {webhookAdded ? (
              <p className="obw-added-note">
                <Check size={13} aria-hidden="true" />
                Webhook saved — alerts will also hit that URL.
              </p>
            ) : (
              <div className="obw-webhook">
                <button
                  type="button"
                  className="obw-webhook__toggle"
                  onClick={() => setWebhookOpen((v) => !v)}
                  aria-expanded={webhookOpen}
                >
                  <Webhook size={14} aria-hidden="true" />
                  Add webhook (optional)
                  <ChevronDown
                    size={14}
                    className={`obw-webhook__chevron ${webhookOpen ? 'obw-webhook__chevron--open' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {webhookOpen && (
                  <form onSubmit={handleAddWebhook} className="obw-webhook__form">
                    <Input
                      label="Webhook URL"
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      required
                    />
                    <Select
                      label="Type"
                      value={webhookType}
                      onChange={(e) => setWebhookType(e.target.value)}
                    >
                      {WEBHOOK_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="secondary" loading={addingWebhook}>
                      Save webhook
                    </Button>
                  </form>
                )}
              </div>
            )}

            <div className="obw-preview-label">What a DOWN alert looks like</div>
            <div className="obw-email" aria-hidden="true">
              <div className="obw-email__meta">
                <span>DevPulse Alerts</span>
                <span>to {user.email}</span>
              </div>
              <div className="obw-email__body">
                <div className="obw-email__toprow">
                  <span className="obw-email__badge">🔴 DOWN</span>
                  <span className="obw-email__time">{alertTime} UTC</span>
                </div>
                <div className="obw-email__endpoint">{name || 'Production API'}</div>
                <div className="obw-email__text">
                  We couldn&apos;t reach your endpoint after 3 consecutive checks.
                </div>
                <span className="obw-email__btn">View dashboard</span>
              </div>
            </div>

            <Button block size="lg" onClick={() => setStep(3)}>
              Continue →
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="obw-body">
            <div className="obw-urlbox">
              <span className="obw-urlbox__url" title={statusUrl}>
                {statusUrl}
              </span>
              <span className="obw-urlbox__actions">
                <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={handleCopy}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <a
                  className="btn btn--ghost btn--sm obw-urlbox__visit"
                  href={`/status/${encodeURIComponent(user.username || '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  Visit
                </a>
              </span>
            </div>
            <p className="obw-urlbox__hint">
              Anyone with this link can see live uptime — no login needed.
            </p>

            <Button block size="lg" onClick={handleStartMonitoring} loading={completing}>
              Start Monitoring →
            </Button>
          </div>
        )}

        <div className="obw-footer">
          <button
            type="button"
            className="obw-skip"
            onClick={handleSkip}
            disabled={completing}
          >
            Skip for now
          </button>
          <span className="obw-footer__spacer" />
          <span className="obw-footer__count">Step {step} of {STEPS.length}</span>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
