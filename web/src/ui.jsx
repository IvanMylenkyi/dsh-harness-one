// 轻量 UI 基元：toast 通知 + 行内确认弹窗 + 通用 Modal。
// 替换 alert/confirm/prompt（原生对话框阻塞且与整体 UI 割裂）。

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useI18n } from './i18n/index.js';

// ---------------- Toast ----------------

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const push = useCallback((text, kind = 'info', ms = 3200) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-4), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role="status" aria-live="polite">{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------------- Modal ----------------

export function Modal({ title, children, onClose, footer, className = '' }) {
  const { t } = useI18n();
  const maskRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      const masks = document.querySelectorAll('.modal-mask');
      if (e.key === 'Escape' && masks[masks.length - 1] === maskRef.current) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div ref={maskRef} className={`modal-mask ${className}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal-box">
        <header className="modal-head">
          <strong>{title}</strong>
          <button className="btn-icon" onClick={onClose} title={t('action.close')} aria-label={t('action.close')}>✕</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/** 通用输入弹窗（替代 prompt） */
export function PromptModal({ title, initial = '', placeholder, confirmText, onCancel, onConfirm }) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);
  const resolvedPlaceholder = placeholder ?? t('modal.inputPlaceholder');
  const resolvedConfirmText = confirmText ?? t('action.confirm');
  return (
    <Modal title={title} onClose={onCancel} footer={(
      <>
        <button className="btn" onClick={onCancel}>{t('action.cancel')}</button>
        <button className="btn btn-primary" onClick={() => onConfirm(value)} disabled={!value.trim()}>{resolvedConfirmText}</button>
      </>
    )}>
      <input className="modal-input" autoFocus value={value} placeholder={resolvedPlaceholder} aria-label={title}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onConfirm(value); }} />
    </Modal>
  );
}

/** 确认弹窗（替代 confirm） */
export function ConfirmModal({ title, message, danger = false, confirmText, onCancel, onConfirm }) {
  const { t } = useI18n();
  const resolvedConfirmText = confirmText ?? t('action.confirm');
  return (
    <Modal title={title} onClose={onCancel} footer={(
      <>
        <button className="btn" onClick={onCancel}>{t('action.cancel')}</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{resolvedConfirmText}</button>
      </>
    )}>
      <p className="modal-message">{message}</p>
    </Modal>
  );
}
