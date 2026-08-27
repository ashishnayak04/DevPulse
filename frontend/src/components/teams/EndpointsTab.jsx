import React, { useState, useEffect, useCallback } from 'react';
import { Monitor, Plus, X } from 'lucide-react';
import { api } from '../../api';
import { useToast } from '../Toast';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';

export const EndpointsTab = ({ slug, detail, canManage, myEndpoints, fetchMyEndpoints, onChanged }) => {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) fetchMyEndpoints();
  }, [open, fetchMyEndpoints]);

  const attachedIds = new Set(detail.endpoints.map((ep) => ep.id));
  const available = (myEndpoints || []).filter((ep) => !attachedIds.has(ep.id));

  const attach = async (endpointId) => {
    try {
      const result = await api.post(`/teams/${slug}/endpoints`, { endpointId });
      addToast(result.message || 'Endpoint attached', 'success');
      setOpen(false);
      onChanged();
    } catch (err) {
      addToast(err.message || 'Failed to attach endpoint', 'error');
    }
  };

  const detach = async (ep) => {
    try {
      await api.delete(`/teams/${slug}/endpoints/${ep.id}`);
      addToast(`${ep.name} detached`, 'success');
      onChanged();
    } catch (err) {
      addToast(err.message || 'Failed to detach endpoint', 'error');
    }
  };

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: detail.endpoints.length ? '1px solid var(--border)' : 'none',
        }}
      >
        <span className="sp-list__title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Monitor size={14} />
          Shared endpoints
        </span>
        {canManage && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} />
            Add endpoint
          </Button>
        )}
      </div>

      {detail.endpoints.length === 0 ? (
        <EmptyState
          icon={Monitor}
          title="No endpoints attached"
          description={
            canManage
              ? 'Attach one of your monitors to share its status with the team.'
              : 'Team admins can attach endpoints to share here.'
          }
        />
      ) : (
        detail.endpoints.map((ep) => {
          const isUp = ep.status === 'UP';
          return (
            <div key={ep.id} className="team-endpoint-row">
              <span className={`team-endpoint-dot ${isUp ? 'team-endpoint-dot--up' : 'team-endpoint-dot--down'}`} aria-hidden="true" />
              <div className="team-endpoint-row__body">
                <div className="team-endpoint-row__name">{ep.name}</div>
                <div className="team-endpoint-row__url">{ep.url}</div>
              </div>
              <Badge tone={isUp ? 'up' : 'down'} dot>
                {isUp ? 'UP' : 'DOWN'}
              </Badge>
              {!ep.isActive && <span className="team-table__muted">paused</span>}
              {canManage && (
                <button className="icon-btn" onClick={() => detach(ep)} aria-label={`Detach ${ep.name}`}>
                  <X size={15} />
                </button>
              )}
            </div>
          );
        })
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        icon={Monitor}
        title="Add endpoint"
        subtitle="Choose one of your monitors to share with the team"
      >
        {available.length === 0 ? (
          <EmptyState icon={Monitor} title="Nothing to attach" description="All of your active endpoints are already attached, or you have none yet." />
        ) : (
          available.map((ep) => (
            <button
              key={ep.id}
              type="button"
              className="team-endpoint-row"
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => attach(ep.id)}
            >
              <span className={`team-endpoint-dot ${ep.status === 'UP' ? 'team-endpoint-dot--up' : 'team-endpoint-dot--down'}`} aria-hidden="true" />
              <div className="team-endpoint-row__body">
                <div className="team-endpoint-row__name">{ep.name}</div>
                <div className="team-endpoint-row__url">{ep.url}</div>
              </div>
              <Plus size={15} style={{ color: 'var(--accent-text)' }} />
            </button>
          ))
        )}
      </Modal>
    </Card>
  );
};
