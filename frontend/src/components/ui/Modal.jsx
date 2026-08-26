import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export const Modal = ({ isOpen, onClose, icon: Icon, title, subtitle, children, ariaLabel, variant = 'drawer' }) => {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  if (variant === 'center') {
    return (
      <div className="modal-overlay modal-overlay--center animate-fade-in" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel || title}
          className="modal-center animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-center__body">{children}</div>
          <button ref={closeRef} className="modal__close modal-center__close" onClick={onClose} aria-label="Close dialog">
            <X size={17} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="modal-overlay animate-fade-in" onClick={onClose} />
      <div className="modal-drawer" role="dialog" aria-modal="true" aria-label={ariaLabel || title}>
        <div className="modal__header">
          <div className="modal__header-left">
            {Icon && (
              <div className="modal__icon">
                <Icon size={19} />
              </div>
            )}
            <div>
              <h2 className="modal__title">{title}</h2>
              {subtitle && <p className="modal__subtitle">{subtitle}</p>}
            </div>
          </div>
          <button ref={closeRef} className="modal__close" onClick={onClose} aria-label="Close dialog">
            <X size={17} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </>
  );
};
