import React, { useState, useEffect } from 'react';
import { Save, Globe, Edit3, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { useToast } from './Toast';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Input';
import { AdvancedOptionsFields } from './AddEndpointModal';
import { parseExpectedCodes, emptyHeaderRow } from '../utils/helpers';

function headersToRows(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return [emptyHeaderRow()];
  }
  const rows = Object.entries(headers)
    .filter(([key]) => typeof key === 'string')
    .map(([key, value]) => ({ key, value: typeof value === 'string' ? value : String(value ?? '') }));
  return rows.length > 0 ? rows : [emptyHeaderRow()];
}

export const EditEndpointModal = ({ isOpen, onClose, endpoint, onUpdate }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [intervalMs, setIntervalMs] = useState(60000);
  const [method, setMethod] = useState('GET');
  const [headerRows, setHeaderRows] = useState([emptyHeaderRow()]);
  const [body, setBody] = useState('');
  const [expectedCodes, setExpectedCodes] = useState('');
  const [keywordMatch, setKeywordMatch] = useState('');
  const [sslCheck, setSslCheck] = useState(false);
  const [sslExpiryDays, setSslExpiryDays] = useState(30);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (endpoint) {
      setName(endpoint.name || '');
      setUrl(endpoint.url || '');
      setIntervalMs(endpoint.intervalMs || 60000);
      setMethod(endpoint.method || 'GET');
      setHeaderRows(headersToRows(endpoint.headers));
      setBody(endpoint.body || '');
      setExpectedCodes(
        Array.isArray(endpoint.expectedStatusCodes) && endpoint.expectedStatusCodes.length > 0
          ? endpoint.expectedStatusCodes.join(', ')
          : ''
      );
      setKeywordMatch(endpoint.keywordMatch || '');
      setSslCheck(Boolean(endpoint.sslCheck));
      setSslExpiryDays(endpoint.sslExpiryDays || 30);
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
      const headers = {};
      for (const row of headerRows) {
        const key = row.key.trim();
        if (key) headers[key] = row.value;
      }

      const data = await api.patch(`/endpoints/${endpoint.id}`, {
        name,
        url,
        intervalMs: parseInt(intervalMs, 10),
        method,
        headers,
        body: method === 'POST' || method === 'PUT' ? body : '',
        expectedStatusCodes: parseExpectedCodes(expectedCodes),
        keywordMatch: keywordMatch.trim(),
        sslCheck,
        sslExpiryDays,
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

        <AdvancedOptionsFields
          method={method}
          setMethod={setMethod}
          headerRows={headerRows}
          setHeaderRows={setHeaderRows}
          body={body}
          setBody={setBody}
          expectedCodes={expectedCodes}
          setExpectedCodes={setExpectedCodes}
          keywordMatch={keywordMatch}
          setKeywordMatch={setKeywordMatch}
          sslCheck={sslCheck}
          setSslCheck={setSslCheck}
          sslExpiryDays={sslExpiryDays}
          setSslExpiryDays={setSslExpiryDays}
        />

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
