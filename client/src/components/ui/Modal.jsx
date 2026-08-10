import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const Modal = ({ isOpen, onClose, icon: Icon, title, subtitle, children }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay animate-fade-in" onClick={onClose} />
      <div className="modal-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__header">
          <div className="modal__header-left">
            {Icon && (
              <div className="modal__icon">
                <Icon size={20} />
              </div>
            )}
            <div>
              <h2 className="modal__title">{title}</h2>
              {subtitle && <p className="modal__subtitle">{subtitle}</p>}
            </div>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </>
  );
};
