import React, { useState, useEffect } from 'react';
import { X, Loader, Save, Globe, Edit3, Clock } from 'lucide-react';
import { api } from '../api';
import { useToast } from './Toast';

export const EditEndpointModal = ({ isOpen, onClose, endpoint, onUpdate }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [intervalMs, setIntervalMs] = useState(60000);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (endpoint) {
      setName(endpoint.name || '');
      setUrl(endpoint.url || '');
      setIntervalMs(endpoint.intervalMs || 60000);
      setError('');
    }
  }, [endpoint]);

  if (!isOpen || !endpoint) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return;
    }

    setLoading(true);
    try {
      const data = await api.patch(`/endpoints/${endpoint.id}`, {
        name, url, intervalMs: parseInt(intervalMs, 10),
      });
      onUpdate(data);
      addToast('Endpoint updated successfully', 'success');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update endpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 60, backdropFilter: 'blur(8px)'
      }} className="animate-fade-in" />
      <div className="animate-slide-up" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '420px',
        zIndex: 70,
        background: 'rgba(13, 15, 40, 0.95)',
        backdropFilter: 'blur(32px)',
        borderLeft: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl) 0 0 var(--radius-xl)',
        padding: '32px 28px',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 48px rgba(0,0,0,0.4)'
      }}>
        <style>{`
          .modal-close-btn {
            width: 36px; height: 36px; border-radius: 10px;
            background: rgba(255,255,255,0.04); border: 1px solid var(--border);
            color: var(--text-muted); cursor: pointer; display: flex;
            align-items: center; justify-content: center;
            transition: all 0.2s;
          }
          .modal-close-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
          .modal-field { margin-bottom: 24px; }
          .modal-label {
            display: block; font-size: 13px; font-weight: 500;
            color: var(--text-muted); margin-bottom: 8px;
          }
          .modal-input {
            width: 100%; padding: 14px 16px; border-radius: var(--radius-md);
            background: rgba(0,0,0,0.3); border: 1px solid var(--border);
            color: var(--text-primary); outline: none; font-size: 14px;
            transition: all 0.25s ease;
          }
          .modal-input:focus {
            border-color: rgba(139,92,246,0.4);
            box-shadow: 0 0 0 4px rgba(139,92,246,0.08);
          }
          .modal-input::placeholder { color: var(--text-muted); }
          .modal-select {
            width: 100%; padding: 14px 16px; border-radius: var(--radius-md);
            background: rgba(0,0,0,0.3); border: 1px solid var(--border);
            color: var(--text-primary); outline: none; font-size: 14px;
            cursor: pointer;
          }
          .modal-error {
            padding: 12px 16px; border-radius: var(--radius-sm);
            background: rgba(239,68,68,0.08);
            border: 1px solid rgba(239,68,68,0.15);
            color: #f87171; font-size: 13px; margin-bottom: 24px;
          }
          .input-icon-wrapper { position: relative; }
          .input-icon-wrapper .input-icon {
            position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
            color: var(--text-muted); z-index: 1;
          }
          .input-icon-wrapper .modal-input { padding-left: 44px; }
        `}</style>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '36px', paddingBottom: '20px', borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'var(--accent-gradient)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#fff'
            }}>
              <Save size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Edit Endpoint</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Update endpoint configuration</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="modal-field">
            <label className="modal-label">Name</label>
            <div className="input-icon-wrapper">
              <Edit3 size={16} className="input-icon" />
              <input required type="text" className="modal-input" placeholder="e.g. Production API" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <div className="modal-field">
            <label className="modal-label">URL</label>
            <div className="input-icon-wrapper">
              <Globe size={16} className="input-icon" />
              <input required type="url" className="modal-input" placeholder="https://api.example.com/health" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          </div>

          <div className="modal-field" style={{ marginBottom: 'auto' }}>
            <label className="modal-label">Check Interval</label>
            <div className="input-icon-wrapper">
              <Clock size={16} className="input-icon" />
              <select className="modal-select" style={{ paddingLeft: 44, appearance: 'none' }} value={intervalMs} onChange={(e) => setIntervalMs(Number(e.target.value))}>
                <option value={60000}>1 minute</option>
                <option value={300000}>5 minutes</option>
                <option value={600000}>10 minutes</option>
                <option value={1800000}>30 minutes</option>
              </select>
            </div>
          </div>

          {error && <div className="modal-error">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '16px' }}>
            {loading ? <><Loader size={18} className="spin" /> Saving...</> : 'Save Changes'}
          </button>
        </form>
      </div>
    </>
  );
};
