import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import './Toast.css';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = 'info', ttl = 4000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, ttl };
    setToasts((s) => [...s, toast]);
    
    setTimeout(() => {
      setToasts((s) => s.filter(t => t.id !== id));
    }, ttl);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((s) => s.filter(t => t.id !== id));
  }, []);

  const value = { push };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container">
        {toasts.map((toast, index) => (
          <ToastItem 
            key={toast.id} 
            toast={toast} 
            index={index}
            onRemove={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, index, onRemove }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      // start leave animation and remove after animation
      setIsLeaving(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, toast.ttl);

    return () => clearTimeout(timer);
  }, [toast.ttl, onRemove, toast.id]);

  const getToastIcon = (type) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '!';
      case 'info': return 'i';
      default: return 'i';
    }
  };

  return (
    <div 
      className={`toast toast-${toast.type} ${isVisible ? 'toast-enter' : ''} ${isLeaving ? 'toast-leave' : ''}`}
      style={{ 
        transform: `translateX(${isVisible ? '0' : '100%'})`,
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <div className="toast-content">
        <div className="toast-icon">
          {getToastIcon(toast.type)}
        </div>
        <div className="toast-message">
          {toast.message}
        </div>
        <button 
          className="toast-close"
          onClick={handleClose}
          aria-label="Đóng thông báo"
        >
          ×
        </button>
      </div>
      <div className="toast-progress">
        <div 
          className="toast-progress-bar"
          style={{
            animation: `toast-progress ${toast.ttl}ms linear forwards`
          }}
        />
      </div>
    </div>
  );
}
