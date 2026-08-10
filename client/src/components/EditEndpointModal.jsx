import React, { useState, useEffect } from 'react';
import { Save, Globe, Edit3, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { useToast } from './Toast';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Input';

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
        name,
        url,
        intervalMs: parseInt(intervalMs, 10),
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      icon={Save}
      title="Edit Endpoint"
      subtitle="Update endpoint configuration"
    >
      <form onSubmit={handleSubmit}>
        <Input
          label="Name"
          icon={Edit3}
          placeholder="e.g. Production API"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
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
          label="Check Interval"
          icon={Clock}
          value={intervalMs}
          onChange={(e) => setIntervalMs(Number(e.target.value))}
        >
          <option value={60000}>1 minute</option>
          <option value={300000}>5 minutes</option>
          <option value={600000}>10 minutes</option>
          <option value={1800000}>30 minutes</option>
        </Select>

        {error && (
          <div className="auth-error animate-slide-down" role="alert">
            <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
            {error}
          </div>
        )}

        <div className="modal__footer">
          <Button type="submit" block size="lg" loading={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
