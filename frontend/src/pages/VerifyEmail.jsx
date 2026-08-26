import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Activity as PulseIcon, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../api';
import { Spinner } from '../components/ui/Spinner';
import { AuthBrand } from '../components/AuthBrand';

const Logo = () => (
  <span className="logo-mark" style={{ width: 44, height: 44 }}>
    <PulseIcon size={24} />
  </span>
);

export const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState(token ? 'verifying' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This verification link is invalid or has expired.');
  const didRequest = useRef(false);

  useEffect(() => {
    if (!token || didRequest.current) return;
    didRequest.current = true;

    api
      .get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((data) => {
        setMessage(data.message);
        setStatus('success');
      })
      .catch((err) => {
        setMessage(err.message || 'Failed to verify email');
        setStatus('error');
      });
  }, [token]);

  return (
    <div className="auth-page">
      <AuthBrand />

      <main className="auth-form">
        <div className="auth-card animate-fade-in">
          <div className="auth-card__logo">
            <Logo />
          </div>

          {status === 'verifying' && (
            <>
              <h1 className="auth-card__title">Verifying...</h1>
              <p className="auth-card__subtitle">Hang tight while we confirm your email address.</p>
              <div className="full-center" style={{ padding: '32px 0' }}>
                <Spinner size="lg" />
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{ color: 'var(--accent)', marginBottom: 14 }}>
                <CheckCircle size={40} />
              </div>
              <h1 className="auth-card__title">Email verified</h1>
              <p className="auth-card__subtitle">{message}</p>
              <div style={{ marginTop: -8 }}>
                <Link to="/login">Continue to sign in</Link>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{ color: 'var(--danger-text)', marginBottom: 14 }}>
                <AlertTriangle size={40} />
              </div>
              <h1 className="auth-card__title">Verification failed</h1>
              <p className="auth-card__subtitle">{message}</p>
              <div style={{ marginTop: -8 }}>
                <Link to="/login">Continue to sign in</Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};


export default VerifyEmail;
