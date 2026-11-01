import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { describeError } from '@/components/ui';

type ToastKind = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  /** Formats an unknown thrown value through describeError. */
  error: (error: unknown) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId++;
      setToasts((current) => [...current, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message: string) => show(message, 'success'),
      error: (error: unknown) => show(describeError(error), 'error'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast${toast.kind === 'info' ? '' : ` toast--${toast.kind}`}`}>
            <span className="grow">{toast.message}</span>
            <button type="button" className="toast__close" aria-label="Đóng" onClick={() => dismiss(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
