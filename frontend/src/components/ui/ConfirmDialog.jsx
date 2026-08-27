import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export const ConfirmDialog = React.memo(({ isOpen, title, description, confirmLabel = 'Delete', onClose, onConfirm, loading }) => (
  <Modal isOpen={isOpen} onClose={onClose} ariaLabel={title} variant="center">
    <div style={{ padding: 4 }}>
      <div className="confirm-icon">
        <AlertTriangle size={22} />
      </div>
      <h2 className="confirm-title">{title}</h2>
      <p className="confirm-desc">{description}</p>
      <div className="confirm-actions">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  </Modal>
));
