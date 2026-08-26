import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Activity as PulseIcon, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AuthBrand } from '../components/AuthBrand';

const Logo = () => (
  <span className="logo-mark" style={{ width: 44, height: 44 }}>
    <PulseIcon size={24} />
  </span>
);

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.post('/auth/forgot-password', { email });
      setMessage(data.message);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset link');
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

          {sent ? (
            <>
              <div style={{ color: 'var(--accent)', marginBottom: 14 }}>
                <CheckCircle size={40} />
              </div>
              <h1 className="auth-card__title">Check your inbox</h1>
              <p className="auth-card__subtitle">{message}</p>
              <div style={{ marginTop: -8 }}>
                <Link to="/login">Back to sign in</Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="auth-card__title">Reset password</h1>
              <p className="auth-card__subtitle">
                Enter your account email and we&apos;ll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                <Input
                  label="Email"
                  type="email"
                  icon={Mail}
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />

                {error && (
                  <div className="auth-error animate-slide-down" role="alert">
                    <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                    {error}
                  </div>
                )}

                <Button type="submit" block size="lg" loading={loading}>
                  {loading ? 'Sending...' : 'Send reset link'}
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


export default ForgotPassword;
