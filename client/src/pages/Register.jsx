import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Loader, Shield, Eye, EyeOff } from 'lucide-react';

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
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', position: 'relative', overflow: 'hidden'
    }}>
      <style>{`
        .auth-wrapper {
          position: relative;
          width: 100%;
          max-width: 440px;
          padding: 48px 40px;
          border-radius: var(--radius-xl);
          background: rgba(13, 15, 40, 0.6);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
        }
        .auth-wrapper::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: var(--radius-xl);
          padding: 1px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(6, 182, 212, 0.2), rgba(236, 72, 153, 0.2));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .auth-glow {
          position: absolute;
          top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle at 30% 40%, rgba(139, 92, 246, 0.08) 0%, transparent 60%),
                      radial-gradient(circle at 70% 60%, rgba(236, 72, 153, 0.06) 0%, transparent 60%);
          pointer-events: none;
          animation: float 8s ease-in-out infinite;
        }
        .auth-logo {
          width: 56px; height: 56px; border-radius: 16px;
          background: var(--accent-gradient-2);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
          box-shadow: 0 8px 32px rgba(236, 72, 153, 0.3);
        }
        .auth-title {
          font-size: 28px; font-weight: 800; text-align: center; margin-bottom: 8px;
          letter-spacing: -1px;
        }
        .auth-subtitle {
          text-align: center; color: var(--text-muted); font-size: 14px; margin-bottom: 36px;
        }
        .auth-input-wrapper {
          position: relative;
        }
        .auth-input-wrapper .auth-icon-left {
          position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
          color: var(--text-muted); z-index: 1;
          transition: color 0.25s ease;
        }
        .auth-input-wrapper:focus-within .auth-icon-left { color: #a78bfa; }
        .auth-input-field {
          width: 100%; padding: 16px 16px 16px 48px; border-radius: var(--radius-md);
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: var(--text-primary); outline: none;
          transition: all 0.25s ease; font-size: 14px;
        }
        .auth-input-field:focus {
          border-color: rgba(139, 92, 246, 0.4);
          box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.08);
          background: rgba(0, 0, 0, 0.4);
        }
        .auth-input-field::placeholder { color: var(--text-muted); }
        .auth-input-field.invalid { border-color: rgba(239, 68, 68, 0.4); }
        .auth-toggle-pw {
          position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: var(--text-muted); cursor: pointer;
          padding: 4px; transition: color 0.2s;
        }
        .auth-toggle-pw:hover { color: var(--text-secondary); }
        .auth-error {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 16px; border-radius: var(--radius-sm);
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.15);
          color: #f87171; font-size: 13px; margin-bottom: 24px;
        }
        .auth-hint {
          font-size: 12px; color: var(--text-muted); margin-top: 6px; margin-left: 4px;
        }
        .auth-login-link {
          text-align: center; font-size: 14px; color: var(--text-muted); margin-top: 28px;
        }
        .auth-login-link a {
          color: #a78bfa; font-weight: 600;
          transition: color 0.2s;
        }
        .auth-login-link a:hover { color: #c4b5fd; }
        .floating-shapes {
          position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
        }
        .floating-shape {
          position: absolute; border-radius: 50%; opacity: 0.15;
        }
      `}</style>

      <div className="floating-shapes">
        <div className="floating-shape float" style={{
          width: 300, height: 300, top: '15%', right: '5%',
          background: 'radial-gradient(circle, rgba(236,72,153,0.3) 0%, transparent 70%)',
          animationDelay: '0s'
        }} />
        <div className="floating-shape float" style={{
          width: 200, height: 200, bottom: '10%', left: '8%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)',
          animationDelay: '2s'
        }} />
        <div className="floating-shape float" style={{
          width: 180, height: 180, top: '40%', left: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)',
          animationDelay: '4s'
        }} />
      </div>

      <div className="auth-wrapper animate-scale-in">
        <div className="auth-glow" />

        <div className="auth-logo">
          <Shield size={28} color="white" />
        </div>

        <h1 className="auth-title">
          <span className="text-gradient-pink">Create Account</span>
        </h1>
        <p className="auth-subtitle">Join DevPulse to monitor your APIs</p>

        <form onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <div className="auth-input-wrapper">
              <Mail size={18} className="auth-icon-left" />
              <input
                type="email"
                placeholder="Email address"
                className="auth-input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <div className="auth-input-wrapper">
              <User size={18} className="auth-icon-left" />
              <input
                type="text"
                placeholder="Username"
                className={`auth-input-field ${!isUsernameValid ? 'invalid' : ''}`}
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
              />
            </div>
            {!isUsernameValid && (
              <div className="auth-hint" style={{ color: '#f87171' }}>
                Lowercase alphanumeric & hyphens only
              </div>
            )}
          </div>

          <div className="auth-input-group" style={{ marginBottom: '28px' }}>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-icon-left" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password (min 8 chars)"
                className={`auth-input-field ${!isPasswordValid ? 'invalid' : ''}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth-toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="auth-error animate-slide-down">
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isUsernameValid || !isPasswordValid}
            className="btn-auth"
          >
            {loading ? (
              <><Loader size={18} className="spin" /> Creating account...</>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="auth-login-link">
          Already have an account?{' '}
          <Link to="/login">Log in here</Link>
        </div>
      </div>
    </div>
  );
};
