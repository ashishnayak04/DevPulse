import React, { useState } from 'react';
import { Plus, Globe, Edit3, Clock, AlertTriangle, ChevronDown, Braces, FileText, Hash, Type, ShieldCheck, X, Plus as PlusIcon } from 'lucide-react';
import { api } from '../api';
import { useToast } from './Toast';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Input';
import { parseExpectedCodes, emptyHeaderRow } from '../utils/helpers';
import '../styles/advanced-endpoint.css';

const METHODS = ['GET', 'POST', 'HEAD', 'PUT'];
const SSL_DAYS_OPTIONS = [7, 14, 30, 60, 90];
const MAX_HEADERS = 10;

export const AdvancedOptionsFields = ({
  method,
  setMethod,
  headerRows,
  setHeaderRows,
  body,
  setBody,
  expectedCodes,
  setExpectedCodes,
  keywordMatch,
  setKeywordMatch,
  sslCheck,
  setSslCheck,
  sslExpiryDays,
  setSslExpiryDays,
}) => {
  const configuredCount =
    (method !== 'GET' ? 1 : 0) +
    (headerRows.filter((r) => r.key.trim()).length > 0 ? 1 : 0) +
    ((method === 'POST' || method === 'PUT') && body.trim() ? 1 : 0) +
    (parseExpectedCodes(expectedCodes).length > 0 ? 1 : 0) +
    (keywordMatch.trim() ? 1 : 0) +
    (sslCheck ? 1 : 0);

  const updateRow = (index, field, value) => {
    setHeaderRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addRow = () => {
    if (headerRows.length < MAX_HEADERS) {
      setHeaderRows((prev) => [...prev, emptyHeaderRow()]);
    }
  };

  const removeRow = (index) => {
    setHeaderRows((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <details className="advanced-options">
      <summary className="advanced-options__summary">
        <Type size={14} aria-hidden="true" />
        Advanced options
        {configuredCount > 0 && <span className="advanced-options__badge">{configuredCount}</span>}
        <span className="advanced-options__chevron">
          <ChevronDown size={15} />
        </span>
      </summary>

      <div className="advanced-options__body">
        <div className="advanced-options__divider" role="presentation" />

        <Select label="HTTP Method" value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>

        <div className="adv-headers">
          <label className="field__label">Custom Headers</label>
          {headerRows.map((row, index) => (
            <div className="adv-headers__row" key={index}>
              <input
                type="text"
                placeholder="Header name"
                value={row.key}
                onChange={(e) => updateRow(index, 'key', e.target.value)}
                maxLength={128}
                aria-label={`Header name ${index + 1}`}
              />
              <input
                type="text"
                placeholder="Value"
                value={row.value}
                onChange={(e) => updateRow(index, 'value', e.target.value)}
                maxLength={500}
                aria-label={`Header value ${index + 1}`}
              />
              <button
                type="button"
                className="adv-headers__remove"
                onClick={() => removeRow(index)}
                disabled={headerRows.length === 1}
                aria-label={`Remove header ${index + 1}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="adv-headers__add"
            onClick={addRow}
            disabled={headerRows.length >= MAX_HEADERS}
          >
            <PlusIcon size={13} />
            Add header{headerRows.length >= MAX_HEADERS ? ` (max ${MAX_HEADERS})` : ''}
          </button>
        </div>

        {(method === 'POST' || method === 'PUT') && (
          <div>
            <label className="field__label">
              <FileText size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              Request Body
            </label>
            <textarea
              className="adv-textarea"
              placeholder='e.g. {"key": "value"}'
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={10000}
            />
            <p className="adv-hint">Sent with POST/PUT requests · max 10,000 characters</p>
          </div>
        )}

        <Input
          label={
            <>
              <Hash size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              Expected Status Codes
            </>
          }
          type="text"
          inputMode="numeric"
          placeholder="e.g. 200, 201, 204"
          value={expectedCodes}
          onChange={(e) => setExpectedCodes(e.target.value)}
          hint="Comma-separated. Empty = any 2xx/3xx counts as up."
        />

        <Input
          label={
            <>
              <Braces size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              Keyword Match
            </>
          }
          type="text"
          placeholder="e.g. &quot;status&quot;:&quot;ok&quot;"
          value={keywordMatch}
          onChange={(e) => setKeywordMatch(e.target.value)}
          hint="Check fails unless this text appears in the response (case-insensitive). Max 200 chars."
        />

        <div className="adv-ssl-row">
          <label className="adv-ssl-toggle">
            <input
              type="checkbox"
              checked={sslCheck}
              onChange={(e) => setSslCheck(e.target.checked)}
            />
            <ShieldCheck size={14} aria-hidden="true" />
            SSL certificate check
          </label>
          <div className="adv-ssl-days">
            <select
              value={sslExpiryDays}
              onChange={(e) => setSslExpiryDays(Number(e.target.value))}
              disabled={!sslCheck}
              aria-label="Warn when certificate expires within days"
            >
              {SSL_DAYS_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  Warn ≤ {d} days left
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </details>
  );
};

export const AddEndpointModal = ({ isOpen, onClose, onAdd }) => {
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

  const resetAdvanced = () => {
    setMethod('GET');
    setHeaderRows([emptyHeaderRow()]);
    setBody('');
    setExpectedCodes('');
    setKeywordMatch('');
    setSslCheck(false);
    setSslExpiryDays(30);
  };

  const buildPayload = () => {
    const headers = {};
    for (const row of headerRows) {
      const key = row.key.trim();
      if (key) headers[key] = row.value;
    }

    const payload = {
      name,
      url,
      intervalMs: parseInt(intervalMs, 10),
      method,
      headers,
      expectedStatusCodes: parseExpectedCodes(expectedCodes),
      sslCheck,
      sslExpiryDays,
    };

    if (method === 'POST' || method === 'PUT') {
      payload.body = body;
    }
    if (keywordMatch.trim()) {
      payload.keywordMatch = keywordMatch.trim();
    }
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post('/endpoints', buildPayload());
      onAdd({
        ...data,
        status: 'UP',
        lastResponseTime: null,
        lastChecked: null,
      });

      addToast(`Now monitoring ${data.name || url}`, 'success');
      setName('');
      setUrl('');
      setIntervalMs(60000);
      resetAdvanced();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create endpoint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      icon={Plus}
      title="Add Endpoint"
      subtitle="Monitor a new API endpoint"
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
            {loading ? 'Adding...' : 'Add Endpoint'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
