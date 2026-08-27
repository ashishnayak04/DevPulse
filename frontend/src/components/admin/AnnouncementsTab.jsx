import React, { useState } from 'react';
import { Megaphone, Trash2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const ANNOUNCEMENT_MAX = 280;
const announcementTone = (type) =>
  type === 'error' ? 'down' : type === 'warning' ? 'warning' : 'accent';

export const AnnouncementsTab = ({
  annMessage,
  setAnnMessage,
  annType,
  setAnnType,
  activeAnnouncement,
  posting,
  onPost,
  clearTarget,
  setClearTarget,
  clearing,
  onClear,
}) => {
  const previewText = annMessage.trim();

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <div className="settings-section__head" style={{ marginBottom: 16 }}>
          <Megaphone size={16} />
          <div>
            <h2 className="settings-section__title">New announcement</h2>
            <p className="settings-section__desc">Shown as a dismissible banner at the top of every page.</p>
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="announcement-message">Message</label>
          <textarea
            id="announcement-message"
            className="field__input adm-textarea"
            rows={3}
            maxLength={ANNOUNCEMENT_MAX}
            placeholder="e.g. Scheduled maintenance tonight at 02:00 UTC"
            value={annMessage}
            onChange={(e) => setAnnMessage(e.target.value.slice(0, ANNOUNCEMENT_MAX))}
          />
          <div className={`adm-counter ${annMessage.length >= ANNOUNCEMENT_MAX ? 'adm-counter--limit' : ''}`}>
            {annMessage.length}/{ANNOUNCEMENT_MAX}
          </div>
        </div>
        <div className="adm-announce-actions">
          <Select
            aria-label="Announcement type"
            value={annType}
            onChange={(e) => setAnnType(e.target.value)}
            style={{ width: 150 }}
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </Select>
          <Button onClick={onPost} loading={posting} disabled={!previewText}>
            <Megaphone size={14} />
            Post announcement
          </Button>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 className="adm-drawer__section-title">Preview</h3>
        <div className="adm-preview-banner">
          {previewText ? (
            <div className={`announcement-banner announcement-banner--${annType}`}>
              <span>{previewText}</span>
            </div>
          ) : (
            <p className="adm-preview-empty">Start typing above to preview the banner.</p>
          )}
        </div>
      </Card>

      <Card>
        <div className="setting-row">
          <span className="setting-row__label">Active announcement</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {activeAnnouncement ? (
              <>
                <Badge tone={announcementTone(activeAnnouncement.type)} dot>
                  {(activeAnnouncement.type || 'info').toUpperCase()}
                </Badge>
                <span className="adm-active-msg">{activeAnnouncement.message}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="btn--danger-ghost"
                  onClick={() => setClearTarget(true)}
                >
                  <Trash2 size={14} />
                  Clear
                </Button>
              </>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None published</span>
            )}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        isOpen={clearTarget}
        title="Clear announcement?"
        description="The banner will disappear for everyone immediately. This action is recorded in the audit log."
        confirmLabel="Clear announcement"
        onClose={() => setClearTarget(false)}
        onConfirm={onClear}
        loading={clearing}
      />
    </>
  );
};
