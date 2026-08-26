import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, removing: false }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, removing: true } : t)));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 260);
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, removing: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 260);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => {
          const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? XCircle : Info;
          return (
            <div
              key={toast.id}
              className={`toast toast--${toast.type} ${toast.removing ? 'toast--removing' : ''}`}
              role="status"
            >
              <Icon size={18} aria-hidden="true" />
              <span className="toast__body">{toast.message}</span>
              <button
                className="toast__remove"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
