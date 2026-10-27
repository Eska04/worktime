import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import type { PropsWithChildren, ReactNode, ButtonHTMLAttributes } from 'react';
import { Check, X, AlertCircle, Inbox } from 'lucide-react';
import { duration } from '../../../shared/time';
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  return <button className={`button ${variant} ${className}`} {...props} />;
}
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <div className="error-box" role="alert">
      <AlertCircle size={18} />
      <span>{error instanceof Error ? error.message : String(error)}</span>
    </div>
  ) : null;
}
export function Empty({
  title = 'Пока здесь пусто',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={28} />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Загружаем данные…
    </div>
  );
}
export function Avatar({
  name,
  large = false,
  initials = 2,
}: {
  name: string;
  large?: boolean;
  initials?: 1 | 2;
}) {
  return (
    <span className={`avatar ${large ? 'large' : ''}`} aria-hidden="true">
      {name
        .trim()
        .split(/\s+/)
        .slice(0, initials)
        .map((w) => w[0])
        .join('')
        .toUpperCase()}
    </span>
  );
}
export function LiveDuration({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="digits">{duration((now - Date.parse(startedAt)) / 1000)}</span>;
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const b = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <header className="modal-head">
        <h2 id={id}>{title}</h2>
        <Button variant="ghost" type="button" aria-label="Закрыть" onClick={onClose}>
          <X size={20} />
        </Button>
      </header>
      {children}
    </dialog>
  );
}
const ToastContext = createContext<(message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider value={setToast}>
      {children}
      {toast && (
        <div className="toast" role="status">
          <Check size={20} />
          <span>{toast}</span>
          <Button variant="ghost" aria-label="Закрыть уведомление" onClick={() => setToast('')}>
            <X size={18} />
          </Button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
export function Confirm({
  title,
  children,
  onClose,
  onConfirm,
  pending,
  error,
  danger = false,
  label = 'Подтвердить',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  error: unknown;
  danger?: boolean;
  label?: string;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="modal-body">
        {children}
        <ErrorMessage error={error} />
      </div>
      <footer className="modal-actions">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Отмена
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={pending}>
          {pending ? 'Сохраняем…' : label}
        </Button>
      </footer>
    </Modal>
  );
}
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
