import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertOctagon, GitBranch, Search, Shield, FileText, Clock,
  ChevronDown, ChevronRight, ExternalLink, RefreshCw, CheckCircle2,
  XCircle, AlertTriangle, Info, Loader2, Link2
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { api } from '../api';
import { useSocket } from '../hooks/useSocket';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { RelativeTime } from '../components/RelativeTime';
import { formatTime, formatRelative } from '../utils/time';
import '../styles/investigation.css';

const CONFIDENCE_COLORS = {
  high: 'var(--success)',
  medium: 'var(--warning)',
  low: 'var(--danger)',
};

function confidenceLabel(c) {
  if (c >= 0.8) return 'high';
  if (c >= 0.5) return 'medium';
  return 'low';
}

function humanizeDuration(ms) {
  if (ms == null || ms < 0) return '\u2014';
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

function riskBadge(risk) {
  const map = { critical: 'down', high: 'down', medium: 'warning', low: 'up' };
  return <Badge tone={map[risk] || 'neutral'}>{(risk || 'unknown').toUpperCase()}</Badge>;
}

function verificationBadge(status) {
  const map = { PASS: 'up', FAILED: 'down', INCONCLUSIVE: 'warning', RUNNING: 'accent', QUEUED: 'neutral' };
  const label = { PASS: 'PASS', FAILED: 'FAILED', INCONCLUSIVE: 'INCONCLUSIVE', RUNNING: 'RUNNING', QUEUED: 'QUEUED' };
  return <Badge tone={map[status] || 'neutral'} dot pulse={status === 'RUNNING'}>{label[status] || status}</Badge>;
}

function classificationBadge(cls) {
  const map = { FACT: 'up', INFERENCE: 'warning', HYPOTHESIS: 'accent' };
  return <Badge tone={map[cls] || 'neutral'}>{cls}</Badge>;
}

const SectionHeader = ({ icon: Icon, title, extra }) => (
  <div className="inv-section__header">
    <div className="inv-section__title">
      <Icon size={16} />
      <span>{title}</span>
    </div>
    {extra}
  </div>
);

const Collapsible = ({ title, count, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="inv-collapsible">
      <button type="button" className="inv-collapsible__trigger" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{title}</span>
        {count != null && <span className="inv-collapsible__count">{count}</span>}
      </button>
      {open && <div className="inv-collapsible__body">{children}</div>}
    </div>
  );
};

export const InvestigationDetail = () => {
  const { id: incidentId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { socket } = useSocket();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [investigation, setInvestigation] = useState(null);
  const [similar, setSimilar] = useState(null);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const fetchInvestigation = useCallback(async () => {
    try {
      const data = await api.get(`/investigations/by-incident/${incidentId}`);
      setInvestigation(data.investigation);
    } catch (err) {
      if (err.status === 404) {
        setInvestigation(null);
      } else {
        addToast(err.message || 'Failed to load investigation', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [incidentId, addToast]);

  const fetchSimilar = useCallback(async () => {
    if (!investigation?.id) return;
    setSimilarLoading(true);
    try {
      const data = await api.get(`/investigations/${investigation.id}/similar`);
      setSimilar(data);
    } catch {
      setSimilar(null);
    } finally {
      setSimilarLoading(false);
    }
  }, [investigation?.id]);

  useEffect(() => {
    fetchInvestigation();
  }, [fetchInvestigation]);

  useEffect(() => {
    if (investigation?.id && investigation.status === 'COMPLETED') {
      fetchSimilar();
    }
  }, [investigation?.id, investigation?.status, fetchSimilar]);

  useEffect(() => {
    if (!socket) return;
    const onStarted = (payload) => {
      if (payload.incidentId === incidentId) {
        setInvestigation((prev) => prev ? { ...prev, status: 'RUNNING', startedAt: new Date().toISOString() } : prev);
      }
    };
    const onCompleted = (payload) => {
      if (payload.incidentId === incidentId) {
        fetchInvestigation();
      }
    };
    const onFailed = (payload) => {
      if (payload.incidentId === incidentId) {
        setInvestigation((prev) => prev ? { ...prev, status: 'FAILED', error: payload.error } : prev);
      }
    };
    const onVerificationCompleted = (payload) => {
      if (payload.incidentId === incidentId) {
        fetchInvestigation();
      }
    };
    socket.on('investigation:started', onStarted);
    socket.on('investigation:completed', onCompleted);
    socket.on('investigation:failed', onFailed);
    socket.on('verification:completed', onVerificationCompleted);
    socket.on('verification:failed', onVerificationCompleted);
    return () => {
      socket.off('investigation:started', onStarted);
      socket.off('investigation:completed', onCompleted);
      socket.off('investigation:failed', onFailed);
      socket.off('verification:completed', onVerificationCompleted);
      socket.off('verification:failed', onVerificationCompleted);
    };
  }, [socket, incidentId, fetchInvestigation]);

  const handleRerun = async () => {
    if (!investigation?.id || rerunning) return;
    setRerunning(true);
    try {
      await api.post(`/investigations/${investigation.id}/rerun`);
      setInvestigation((prev) => prev ? { ...prev, status: 'QUEUED', error: null, startedAt: null, completedAt: null } : prev);
      addToast('Investigation re-queued', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to re-run investigation', 'error');
    } finally {
      setRerunning(false);
    }
  };

  const handleVerify = async () => {
    if (verifying) return;
    setVerifying(true);
    try {
      await api.post(`/incidents/${incidentId}/verify`);
      addToast('Fix verification queued', 'success');
      fetchInvestigation();
    } catch (err) {
      addToast(err.message || 'Failed to trigger verification', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const inv = investigation;
  const incident = inv?.incident;
  const isOpen = incident && !incident.resolvedAt;
  const isRunning = inv?.status === 'RUNNING' || inv?.status === 'QUEUED';
  const isCompleted = inv?.status === 'COMPLETED';
  const hasFix = inv?.suggestedFix && inv.suggestedFix !== '';

  const subtitle = incident
    ? `${incident.endpoint?.name || 'Unknown'} \u00b7 ${isOpen ? 'Open' : 'Resolved'} \u00b7 ${humanizeDuration(incident.durationMs)}`
    : 'Loading...';

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        <div className="page">
          <PageHeader
            title="Investigation"
            subtitle={subtitle}
            onBack={() => navigate('/incidents')}
            onMenu={() => setSidebarOpen(true)}
            actions={inv?.status === 'COMPLETED' ? (
              <>
                {hasFix && (
                  <Button size="sm" variant="secondary" icon={RefreshCw} loading={rerunning} onClick={handleRerun}>
                    Re-run
                  </Button>
                )}
                <Button size="sm" icon={Shield} loading={verifying} onClick={handleVerify}>
                  Verify Fix
                </Button>
              </>
            ) : inv?.status === 'FAILED' ? (
              <Button size="sm" icon={RefreshCw} loading={rerunning} onClick={handleRerun}>
                Re-run
              </Button>
            ) : null}
          />

          {loading ? (
            <Card>
              <div className="inv-loading"><Spinner size="lg" /></div>
            </Card>
          ) : !inv ? (
            <Card>
              <EmptyState
                icon={Search}
                title="No investigation found"
                description="This incident has not been investigated yet."
                action={
                  <Button size="sm" onClick={() => navigate('/incidents')}>
                    Back to incidents
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="inv-grid">

              {/* ── Status Bar ── */}
              <Card className="inv-status-bar">
                <div className="inv-status-bar__left">
                  <Badge
                    tone={isCompleted ? 'up' : isRunning ? 'accent' : inv.status === 'FAILED' ? 'down' : 'neutral'}
                    dot
                    pulse={isRunning}
                  >
                    {inv.status}
                  </Badge>
                  {inv.startedAt && (
                    <span className="inv-status-bar__time">
                      Started <RelativeTime time={inv.startedAt} />
                    </span>
                  )}
                  {inv.completedAt && (
                    <span className="inv-status-bar__time">
                      Completed <RelativeTime time={inv.completedAt} />
                    </span>
                  )}
                </div>
                {isRunning && (
                  <div className="inv-status-bar__spinner">
                    <Loader2 size={16} className="inv-spin" />
                    <span>Investigating...</span>
                  </div>
                )}
              </Card>

              {inv.error && (
                <Card className="inv-error-card">
                  <AlertTriangle size={16} />
                  <span>{inv.error}</span>
                </Card>
              )}

              {/* ── Root Cause ── */}
              {isCompleted && inv.rootCause && (
                <Card className="inv-section">
                  <SectionHeader icon={Search} title="Root Cause Analysis" />
                  <div className="inv-root-cause">
                    <p className="inv-root-cause__text">{inv.rootCause}</p>
                    <div className="inv-root-cause__meta">
                      {inv.confidence != null && (
                        <div className="inv-confidence">
                          <span className="inv-confidence__label">Confidence</span>
                          <div className="inv-confidence__bar">
                            <div
                              className="inv-confidence__fill"
                              style={{
                                width: `${Math.round(inv.confidence * 100)}%`,
                                background: CONFIDENCE_COLORS[confidenceLabel(inv.confidence)],
                              }}
                            />
                          </div>
                          <span className="inv-confidence__value">
                            {Math.round(inv.confidence * 100)}%
                          </span>
                        </div>
                      )}
                      {inv.risk && (
                        <div className="inv-root-cause__risk">
                          <span className="inv-confidence__label">Risk</span>
                          {riskBadge(inv.risk)}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* ── Summary ── */}
              {isCompleted && inv.summary && (
                <Card className="inv-section">
                  <SectionHeader icon={FileText} title="Summary" />
                  <p className="inv-summary">{inv.summary}</p>
                </Card>
              )}

              {/* ── Affected Services ── */}
              {isCompleted && inv.affectedServices?.length > 0 && (
                <Card className="inv-section">
                  <SectionHeader icon={AlertOctagon} title="Affected Services" />
                  <div className="inv-tags">
                    {inv.affectedServices.map((svc, i) => (
                      <Badge key={i} tone="warning">{svc}</Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* ── Changed Files ── */}
              {isCompleted && inv.changedFiles?.length > 0 && (
                <Card className="inv-section">
                  <SectionHeader icon={GitBranch} title="Changed Files" />
                  <div className="inv-files">
                    {inv.changedFiles.map((file, i) => (
                      <div key={i} className="inv-file">
                        <FileText size={13} />
                        <code>{typeof file === 'string' ? file : file.filename || JSON.stringify(file)}</code>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* ── Evidence ── */}
              {isCompleted && inv.evidence?.length > 0 && (
                <Card className="inv-section">
                  <SectionHeader icon={Shield} title="Evidence" extra={<span className="inv-section__count">{inv.evidence.length}</span>} />
                  <div className="inv-evidence-list">
                    {inv.evidence.map((item) => (
                      <div key={item.id} className="inv-evidence-item">
                        <div className="inv-evidence-item__header">
                          <span className="inv-evidence-item__title">{item.title}</span>
                          {classificationBadge(item.classification)}
                        </div>
                        {item.detail && (
                          <p className="inv-evidence-item__detail">{item.detail}</p>
                        )}
                        {item.sourceType && (
                          <span className="inv-evidence-item__source">{item.sourceType}{item.sourceKey ? `: ${item.sourceKey}` : ''}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* ── Suggested Fix ── */}
              {isCompleted && hasFix && (
                <Card className="inv-section">
                  <SectionHeader icon={FileText} title="Suggested Fix" />
                  <div className="inv-fix">
                    <p className="inv-fix__text">{inv.suggestedFix}</p>
                    {inv.verificationPlan && (
                      <div className="inv-fix__plan">
                        <span className="inv-fix__plan-label">Verification Plan</span>
                        <p>{inv.verificationPlan}</p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* ── Fix Verification ── */}
              {inv.verifications?.length > 0 && (
                <Card className="inv-section">
                  <SectionHeader icon={CheckCircle2} title="Fix Verification" extra={<span className="inv-section__count">{inv.verifications.length}</span>} />
                  <div className="inv-verifications">
                    {inv.verifications.map((v) => (
                      <div key={v.id} className="inv-verification">
                        <div className="inv-verification__header">
                          {verificationBadge(v.status)}
                          <span className="inv-verification__time">
                            <RelativeTime time={v.createdAt} />
                          </span>
                          {v.deployment && (
                            <span className="inv-verification__deploy">
                              <GitBranch size={12} />
                              {v.deployment.commitSha?.slice(0, 7)}
                              <Badge tone="neutral">{v.deployment.environment}</Badge>
                            </span>
                          )}
                        </div>
                        {v.preMetrics && v.postMetrics && (
                          <div className="inv-metrics">
                            <MetricCompare label="Uptime" pre={v.preMetrics.uptime} post={v.postMetrics.uptime} format={(v) => `${(v * 100).toFixed(1)}%`} higherBetter />
                            <MetricCompare label="Avg Latency" pre={v.preMetrics.avgLatency} post={v.postMetrics.avgLatency} format={(v) => `${Math.round(v)}ms`} />
                            <MetricCompare label="P95" pre={v.preMetrics.p95Latency} post={v.postMetrics.p95Latency} format={(v) => `${Math.round(v)}ms`} />
                            <MetricCompare label="Error Rate" pre={v.preMetrics.errorRate} post={v.postMetrics.errorRate} format={(v) => `${(v * 100).toFixed(1)}%`} higherBetter={false} />
                          </div>
                        )}
                        {v.error && (
                          <div className="inv-verification__error">
                            <AlertTriangle size={13} />
                            <span>{v.error}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* ── Similar Incidents ── */}
              <Card className="inv-section">
                <SectionHeader
                  icon={Search}
                  title="Similar Incidents"
                  extra={similarLoading ? <Spinner size="md" /> : similar?.items?.length != null && <span className="inv-section__count">{similar.items.length}</span>}
                />
                {!similar && !similarLoading && inv.status === 'COMPLETED' && (
                  <p className="inv-empty-text">Similar incidents will appear here once the investigation completes.</p>
                )}
                {similar?.items?.length === 0 && (
                  <p className="inv-empty-text">No similar incidents found.</p>
                )}
                {similar?.items?.length > 0 && (
                  <div className="inv-similar-list">
                    {similar.items.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="inv-similar-item"
                        onClick={() => navigate(`/incidents/${s.id}/investigation`)}
                      >
                        <div className="inv-similar-item__main">
                          <div className="inv-similar-item__endpoint">{s.endpoint?.name || 'Unknown'}</div>
                          {s.summary && <div className="inv-similar-item__summary">{s.summary}</div>}
                        </div>
                        <div className="inv-similar-item__meta">
                          {s.endpointMatch && <Badge tone="accent" dot>Same endpoint</Badge>}
                          {s.score > 0 && <span className="inv-similar-item__score">{(s.score * 100).toFixed(0)}% match</span>}
                          {s.timeGapMinutes != null && (
                            <span className="inv-similar-item__gap">
                              {s.timeGapMinutes < 60 ? `${s.timeGapMinutes}m` : `${Math.round(s.timeGapMinutes / 60)}h`} apart
                            </span>
                          )}
                          <Badge tone={s.status === 'resolved' ? 'up' : 'down'}>{s.status}</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              {/* ── Tool Calls Audit ── */}
              {inv.toolCalls?.length > 0 && (
                <Card className="inv-section">
                  <Collapsible title="Tool Calls" count={inv.toolCalls.length}>
                    <div className="inv-tools">
                      {inv.toolCalls.map((tc) => (
                        <div key={tc.id} className="inv-tool">
                          <div className="inv-tool__header">
                            <code className="inv-tool__name">{tc.toolName}</code>
                            <Badge tone={tc.status === 'success' ? 'up' : 'down'}>{tc.status}</Badge>
                            {tc.durationMs != null && (
                              <span className="inv-tool__duration">{tc.durationMs}ms</span>
                            )}
                          </div>
                          {tc.arguments && (
                            <pre className="inv-tool__args">{JSON.stringify(tc.arguments, null, 2)}</pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </Collapsible>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const MetricCompare = ({ label, pre, post, format, higherBetter = true }) => {
  if (pre == null || post == null) return null;
  const improved = higherBetter ? post > pre : post < pre;
  const degraded = higherBetter ? post < pre : post > pre;
  return (
    <div className="inv-metric">
      <span className="inv-metric__label">{label}</span>
      <span className="inv-metric__pre">{format(pre)}</span>
      <span className="inv-metric__arrow">&rarr;</span>
      <span className={`inv-metric__post ${improved ? 'inv-metric__post--better' : degraded ? 'inv-metric__post--worse' : ''}`}>
        {format(post)}
      </span>
    </div>
  );
};

export default InvestigationDetail;
