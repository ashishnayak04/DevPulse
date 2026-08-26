import React, { useState, useEffect, useCallback } from 'react';
import { AlertOctagon, ChevronDown, Check, X, SendHorizontal } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { RelativeTime } from '../components/RelativeTime';
import { formatTime } from '../utils/time';
import '../styles/incidents.css';

const PAGE_LIMIT = 20;

function humanizeDuration(ms) {
  if (ms == null || ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function incidentDuration(item) {
  const start = new Date(item.startedAt).getTime();
  const end = item.resolvedAt ? new Date(item.resolvedAt).getTime() : Date.now();
  if (item.durationMs != null) return item.durationMs;
  return Math.max(end - start, 0);
}

export const Incidents = () => {
  const { addToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setTick] = useState(0);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');

  const [openId, setOpenId] = useState(null);
  const [details, setDetails] = useState({});
  const [composerFor, setComposerFor] = useState(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [ackingId, setAckingId] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/incidents?page=${page}&limit=${PAGE_LIMIT}&status=${status}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch incidents:', err);
      addToast(err.message || 'Failed to load incidents', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, status, addToast]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const changeStatus = (next) => {
    if (next === status) return;
    setStatus(next);
    setPage(1);
    setOpenId(null);
    setComposerFor(null);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const loadDetail = async (id) => {
    setDetails((prev) => ({ ...prev, [id]: { loading: true, updates: [] } }));
    try {
      const data = await api.get(`/incidents/${id}`);
      setDetails((prev) => ({ ...prev, [id]: { loading: false, updates: data.incident?.updates || [] } }));
    } catch (err) {
      console.error('Failed to fetch incident:', err);
      setDetails((prev) => ({ ...prev, [id]: { loading: false, updates: [], error: err.message } }));
    }
  };

  const toggleExpand = (id) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    setComposerFor(null);
    setDraft('');
    if (next && (!details[id] || details[id].error)) {
      loadDetail(id);
    }
  };

  const submitUpdate = async (id) => {
    const message = draft.trim();
    if (!message || posting) return;
    setPosting(true);
    try {
      const data = await api.post(`/incidents/${id}/updates`, { message });
      setDetails((prev) => ({
        ...prev,
        [id]: { ...prev[id], updates: [...(prev[id]?.updates || []), data.update] },
      }));
      setItems((prev) =>
        prev.map((it) =>
          it.id === id ? { ...it, _count: { ...it._count, updates: (it._count?.updates || 0) + 1 } } : it
        )
      );
      setDraft('');
      setComposerFor(null);
      addToast('Postmortem update posted', 'success');
    } catch (err) {
      console.error('Failed to post update:', err);
      addToast(err.message || 'Failed to post update', 'error');
    } finally {
      setPosting(false);
    }
  };

  const acknowledge = async (id) => {
    if (ackingId) return;
    setAckingId(id);
    try {
      await api.patch(`/incidents/${id}/acknowledge`);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, acknowledged: true } : it)));
      addToast('Incident acknowledged', 'success');
    } catch (err) {
      console.error('Failed to acknowledge incident:', err);
      addToast(err.message || 'Failed to acknowledge incident', 'error');
    } finally {
      setAckingId(null);
    }
  };

  const subtitle =
    total > 0
      ? `${total} incident${total === 1 ? '' : 's'} · ${items.filter((i) => i.status === 'open').length || 'no'} open on this page`
      : 'Uptime outages across all your endpoints';

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        <div className="page">
          <PageHeader
            title="Incidents"
            subtitle={subtitle}
            onMenu={() => setSidebarOpen(true)}
          />

          <div className="incidents-tabs" role="tablist" aria-label="Filter incidents">
            {[
              { value: 'all', label: 'All' },
              { value: 'open', label: 'Open' },
              { value: 'resolved', label: 'Resolved' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={status === tab.value}
                className={`incidents-tab ${status === tab.value ? 'incidents-tab--active' : ''}`}
                onClick={() => changeStatus(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            {loading ? (
              <Card>
                <div className="incidents-loading">
                  <Spinner size="lg" />
                </div>
              </Card>
            ) : items.length === 0 ? (
              <Card>
                <EmptyState
                  icon={AlertOctagon}
                  title="No incidents yet"
                  description="When an endpoint goes down, outages are tracked here with full timelines."
                />
              </Card>
            ) : (
              <>
                <Card className="incidents-list animate-fade-in">
                  {items.map((item) => {
                    const isOpen = item.status === 'open';
                    const expanded = openId === item.id;
                    const detail = details[item.id];

                    return (
                      <React.Fragment key={item.id}>
                        <button
                          type="button"
                          className="incidents-row"
                          onClick={() => toggleExpand(item.id)}
                          aria-expanded={expanded}
                        >
                          <div className="incidents-row__main">
                            <div className="incidents-row__endpoint">{item.endpoint?.name || 'Unknown endpoint'}</div>
                            <div className="incidents-row__url">{item.endpoint?.url}</div>
                          </div>
                          <div className="incidents-row__meta">
                            <span
                              className={`incidents-duration ${isOpen ? 'incidents-duration--open' : ''}`}
                              title={isOpen ? 'Ongoing downtime' : 'Total downtime'}
                            >
                              {humanizeDuration(incidentDuration(item))}
                            </span>
                            <span className="incidents-row__time">
                              <RelativeTime time={item.startedAt} />
                            </span>
                            {item.acknowledged && (
                              <span className="incidents-ack">
                                <Check size={11} strokeWidth={3} />
                                Ack
                              </span>
                            )}
                            <Badge tone={isOpen ? 'down' : 'up'} dot pulse={isOpen}>
                              {isOpen ? 'OPEN' : 'RESOLVED'}
                            </Badge>
                            <ChevronDown size={16} className={`incidents-chevron ${expanded ? 'incidents-chevron--open' : ''}`} />
                          </div>
                        </button>

                        {expanded && (
                          <div className="incidents-detail">
                            {detail?.loading ? (
                              <div className="incidents-loading">
                                <Spinner />
                              </div>
                            ) : (
                              <>
                                <ul className="incidents-timeline">
                                  <li className="incidents-timeline-item">
                                    <span className="incidents-timeline-dot incidents-timeline-dot--down" />
                                    <div className="incidents-timeline-title incidents-timeline-title--down">
                                      Incident started
                                      <span className="incidents-timeline-time">{formatTime(item.startedAt)}</span>
                                    </div>
                                  </li>

                                  {(detail?.updates || []).map((update) => (
                                    <li key={update.id} className="incidents-timeline-item">
                                      <span className="incidents-timeline-dot" />
                                      <div className="incidents-timeline-title">
                                        Update
                                        <span className="incidents-timeline-time">{formatTime(update.createdAt)}</span>
                                      </div>
                                      <p className="incidents-timeline-message">{update.message}</p>
                                    </li>
                                  ))}

                                  {!isOpen && item.resolvedAt && (
                                    <li className="incidents-timeline-item">
                                      <span className="incidents-timeline-dot incidents-timeline-dot--up" />
                                      <div className="incidents-timeline-title incidents-timeline-title--up">
                                        Resolved · {humanizeDuration(item.durationMs)} downtime
                                        <span className="incidents-timeline-time">{formatTime(item.resolvedAt)}</span>
                                      </div>
                                    </li>
                                  )}
                                </ul>

                                <div className="incidents-detail-actions">
                                  {isOpen && !item.acknowledged && (
                                    <Button
                                      size="sm"
                                      loading={ackingId === item.id}
                                      icon={Check}
                                      onClick={() => acknowledge(item.id)}
                                    >
                                      Acknowledge
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    icon={composerFor === item.id ? X : SendHorizontal}
                                    onClick={() => {
                                      setComposerFor(composerFor === item.id ? null : item.id);
                                      setDraft('');
                                    }}
                                  >
                                    {composerFor === item.id ? 'Cancel' : 'Post update'}
                                  </Button>
                                </div>

                                {composerFor === item.id && (
                                  <div className="incidents-post">
                                    <textarea
                                      value={draft}
                                      onChange={(e) => setDraft(e.target.value)}
                                      placeholder="Add a postmortem note…"
                                      maxLength={500}
                                      autoFocus
                                    />
                                    <div className="incidents-post-footer">
                                      <span className="incidents-post-hint">{draft.length}/500</span>
                                      <Button
                                        size="sm"
                                        loading={posting}
                                        disabled={!draft.trim()}
                                        onClick={() => submitUpdate(item.id)}
                                      >
                                        Submit update
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}

                  <div className="incidents-pagination">
                    <span className="incidents-pagination__info">
                      Page {page} of {totalPages}
                    </span>
                    <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Incidents;
