import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Activity as PulseIcon, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AuthBrand } from '../components/AuthBrand';

const Logo = () => (
  <span className="logo-mark" style={{ width: 44, height: 44 }}>
    <PulseIcon size={24} />
  </span>
);

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');

  const isPasswordValid = password.length >= 8 || password === '';
  const doPasswordsMatch = password === confirmPassword || confirmPassword === '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!doPasswordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const data = await api.post('/auth/reset-password', { token, password });
      setMessage(data.message);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthBrand />

      <main className="auth-form">
        <div className="auth-card animate-fade-in">
          <div className="auth-card__logo">
            <Logo />
          </div>

          {!token ? (
            <>
              <div style={{ color: 'var(--danger-text)', marginBottom: 14 }}>
                <AlertTriangle size={40} />
              </div>
              <h1 className="auth-card__title">Invalid link</h1>
              <p className="auth-card__subtitle">
                This password reset link is missing or malformed. Request a new one to continue.
              </p>
              <div style={{ marginTop: -8 }}>
                <Link to="/forgot-password">Request a new link</Link>
              </div>
            </>
          ) : done ? (
            <>
              <div style={{ color: 'var(--accent)', marginBottom: 14 }}>
                <CheckCircle size={40} />
              </div>
              <h1 className="auth-card__title">Password updated</h1>
              <p className="auth-card__subtitle">{message}</p>
              <div style={{ marginTop: -8 }}>
                <Link to="/login">Back to sign in</Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="auth-card__title">Choose a new password</h1>
              <p className="auth-card__subtitle">Pick a strong password you haven&apos;t used before.</p>

              <form onSubmit={handleSubmit} noValidate>
                <Input
                  label="New password"
                  type="password"
                  icon={Lock}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  error={password && !isPasswordValid ? 'Must be at least 8 characters' : ''}
                />

                <Input
                  label="Confirm password"
                  type="password"
                  icon={Lock}
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  error={confirmPassword && !doPasswordsMatch ? 'Passwords do not match' : ''}
                />

                {error && (
                  <div className="auth-error animate-slide-down" role="alert">
                    <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  block
                  size="lg"
                  loading={loading}
                  disabled={loading || !isPasswordValid || !doPasswordsMatch}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>

              <p className="auth-switch">
                Remembered it? <Link to="/login">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
};


export default ResetPassword;
