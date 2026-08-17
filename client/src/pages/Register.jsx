import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Activity as PulseIcon, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AuthBrand } from '../components/AuthBrand';

const Logo = () => (
  <span className="logo-mark" style={{ width: 44, height: 44 }}>
    <PulseIcon size={24} />
  </span>
);

export const Register = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const isUsernameValid = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(username) || username === '';
  const isPasswordValid = password.length >= 8 || password === '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isUsernameValid) {
      setError('Username must be lowercase alphanumeric with hyphens only');
      return;
    }
    if (!isPasswordValid) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      await register(email, username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to register');
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
          <h1 className="auth-card__title">Create your account</h1>
          <p className="auth-card__subtitle">Start watching your APIs in under a minute.</p>

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
              label="Username"
              type="text"
              icon={User}
              placeholder="acme"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              required
              autoComplete="username"
              error={username && !isUsernameValid ? 'Lowercase alphanumeric & hyphens only' : ''}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              icon={Lock}
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              error={password && !isPasswordValid ? 'Must be at least 8 characters' : ''}
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
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              }
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
              disabled={loading || !isUsernameValid || !isPasswordValid}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </main>
    </div>
  );
};


export default Register;
