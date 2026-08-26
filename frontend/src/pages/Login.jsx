import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Activity as PulseIcon, AlertTriangle, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AuthBrand } from '../components/AuthBrand';

const Logo = () => (
  <span className="logo-mark" style={{ width: 44, height: 44 }}>
    <PulseIcon size={24} />
  </span>
);

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Inline TOTP second screen — set when login responds with requiresTOTP
  const [tempToken, setTempToken] = useState(null);
  const [backupMode, setBackupMode] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const { refreshUser } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api.post('/auth/login', { email, password });

      if (data?.requiresTOTP) {
        setTempToken(data.tempToken);
        return;
      }

      // Mirrors AuthContext.login() post-response steps so the app state is
      // identical whether or not the two-factor screen was shown.
      localStorage.setItem('accessToken', data.accessToken);
      await refreshUser();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  const handleTotpSubmit = async (e) => {
    e.preventDefault();
    if (!tempToken) return;
    setTotpLoading(true);

    try {
      const data = await api.post('/auth/totp/challenge', {
        tempToken,
        totpCode: totpCode.replace(/[\s-]/g, ''),
      });

      // Same completion steps as a regular login
      localStorage.setItem('accessToken', data.accessToken);
      await refreshUser();
      navigate('/dashboard');
    } catch (err) {
      const message = err.message || 'Verification failed. Please try again.';
      setError(message);
      addToast(message, 'error');
    } finally {
      setTotpLoading(false);
    }
  };

  const exitTotpScreen = () => {
    setTempToken(null);
    setTotpCode('');
    setBackupMode(false);
    setError('');
  };

  return (
    <div className="auth-page">
      <AuthBrand />

      <main className="auth-form">
        <div className="auth-card animate-fade-in">
          {!tempToken ? (
            <>
              <div className="auth-card__logo">
                <Logo />
              </div>
              <h1 className="auth-card__title">Sign in</h1>
              <p className="auth-card__subtitle">Monitor the services your team depends on.</p>

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

                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  icon={Lock}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  right={
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        padding: 4,
                        display: 'inline-flex',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />

                {error && (
                  <div className="auth-error animate-slide-down" role="alert">
                    <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                    {error}
                  </div>
                )}

                <Button type="submit" block size="lg" loading={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>

                <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 16 }}>
                  <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Forgot password?
                  </Link>
                </div>
              </form>

              <p className="auth-switch">
                Don't have an account? <Link to="/register">Create one</Link>
              </p>
            </>
          ) : (
            <>
              <div className="auth-card__logo">
                <Logo />
              </div>
              <h1 className="auth-card__title">Two-factor authentication</h1>
              <p className="auth-card__subtitle">Enter the 6-digit code from your authenticator app</p>

              <form onSubmit={handleTotpSubmit} noValidate>
                <Input
                  label={backupMode ? 'Backup code' : 'Authentication code'}
                  type="text"
                  icon={KeyRound}
                  inputMode={backupMode ? 'text' : 'numeric'}
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder={backupMode ? 'a1b2c3d4' : '123456'}
                  maxLength={backupMode ? 12 : 6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/[\s-]/g, ''))}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.18em',
                    textAlign: 'center',
                    fontSize: 17,
                  }}
                />

                <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setBackupMode((m) => !m);
                      setTotpCode('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--accent-text)',
                    }}
                  >
                    {backupMode ? 'Use your authenticator app instead' : 'Use a backup code instead'}
                  </button>
                </div>

                {error && (
                  <div className="auth-error animate-slide-down" role="alert">
                    <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                    {error}
                  </div>
                )}

                <Button type="submit" block size="lg" loading={totpLoading}>
                  {totpLoading ? 'Verifying...' : 'Verify'}
                </Button>

                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={exitTotpScreen}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--text-muted)',
                    }}
                  >
                    &larr; Back to sign in
                  </button>
                </div>
              </form>
            </>
          )}

          <div className="auth-divider" role="separator">
            <span>Or continue with</span>
          </div>

          <div className="auth-oauth">
            <a href="/api/auth/google" className="btn btn--secondary auth-oauth__btn">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.97 10.97 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
              Google
            </a>
            <a href="/api/auth/github" className="btn btn--secondary auth-oauth__btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              GitHub
            </a>
          </div>

          <p className="auth-switch" style={{ marginTop: 8 }}>
            <a href="/landing" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              &larr; Back to landing page
            </a>
          </p>
        </div>
      </main>
    </div>
  );
};


export default Login;
