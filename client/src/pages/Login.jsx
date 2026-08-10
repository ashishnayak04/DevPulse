import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Activity as PulseIcon, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AuthBrand } from '../components/AuthBrand';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to log in');
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
            <PulseIcon size={26} />
          </div>
          <h1 className="auth-card__title">Sign in</h1>
          <p className="auth-card__subtitle">Welcome back to your monitoring hub.</p>

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
          </form>

          <p className="auth-switch">
            Don't have an account? <Link to="/register">Create one</Link>
          </p>
        </div>
      </main>
    </div>
  );
};
