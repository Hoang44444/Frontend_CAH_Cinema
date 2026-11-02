import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { useEffect } from 'react';
import { ApiError } from '@/lib/http';
import { initials as toInitials } from '@/lib/format';
import './ui.css';

/* ---------- Button ---------- */

type ButtonVariant =
  | 'accent'
  | 'dark'
  | 'danger'
  | 'outline'
  | 'ghost'
  | 'quiet'
  | 'danger-outline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'lg' | 'md' | 'sm' | 'xs';
  pill?: boolean;
  block?: boolean;
  loading?: boolean;
}

export function Button({
  variant = 'accent',
  size = 'md',
  pill,
  block,
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    pill ? 'btn--pill' : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
      {children}
    </button>
  );
}

/* ---------- Pill & segmented control ---------- */

export function Pill({
  active,
  accent,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; accent?: boolean }) {
  return (
    <button
      type="button"
      className={`pill${accent ? ' pill--accent' : ''}`}
      data-active={active ? 'true' : 'false'}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  accent,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accent?: boolean;
}) {
  return (
    <div className={`seg${accent ? ' seg--accent' : ''}`} role="tablist">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className="seg__item"
          data-active={option.value === value ? 'true' : 'false'}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Badges ---------- */

const RATING_COLOR: Record<string, string> = {
  P: 'var(--rate-p)',
  K: 'var(--rate-k)',
  T13: 'var(--rate-t13)',
  T16: 'var(--rate-t16)',
  T18: 'var(--rate-t18)',
};

export function RatingBadge({ rating, size = 11 }: { rating?: string | null; size?: number }) {
  if (!rating) return null;
  return (
    <span
      className="badge badge--rating"
      style={{ background: RATING_COLOR[rating] ?? 'var(--ink-6)', fontSize: size }}
    >
      {rating}
    </span>
  );
}

const RANK_COLOR: Record<string, string> = {
  SILVER: 'var(--rank-silver)',
  GOLD: 'var(--rank-gold)',
  DIAMOND: 'var(--rank-diamond)',
};

export function RankBadge({ rank }: { rank?: string | null }) {
  if (!rank) return null;
  return (
    <span className="badge badge--rank" style={{ background: RANK_COLOR[rank] ?? 'var(--line-strong)' }}>
      {rank}
    </span>
  );
}

/** Booking / refund status chip. Colours follow the design's status map. */
const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  PAID: { label: 'ĐÃ THANH TOÁN', bg: 'var(--ok)', fg: '#fff' },
  PENDING: { label: 'CHỜ THANH TOÁN', bg: 'var(--accent)', fg: '#fff' },
  CANCELLED: { label: 'ĐÃ HỦY', bg: 'var(--surface-disabled)', fg: 'var(--ink)' },
  EXPIRED: { label: 'HẾT HẠN', bg: 'var(--surface-muted)', fg: 'var(--ink-5)' },
  CHECKED_IN: { label: 'ĐÃ SOÁT VÉ', bg: '#c8d8ea', fg: 'var(--ink)' },
  REFUNDED: { label: 'ĐÃ HOÀN TIỀN', bg: 'var(--info)', fg: 'var(--info-deep)' },
  REQUESTED: { label: 'CHỜ NHẬN', bg: 'var(--accent)', fg: '#fff' },
  PROCESSING: { label: 'ĐANG XỬ LÝ', bg: 'var(--info)', fg: 'var(--info-deep)' },
  SUCCEEDED: { label: 'ĐÃ CHI', bg: 'var(--ok)', fg: '#fff' },
  FAILED: { label: 'THẤT BẠI', bg: 'var(--danger)', fg: '#fff' },
  UNKNOWN: { label: 'KHÔNG RÕ', bg: 'var(--danger)', fg: '#fff' },
  REVIEW_REQUIRED: { label: 'CẦN RÀ SOÁT', bg: 'var(--info)', fg: 'var(--info-deep)' },
};

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  const style = STATUS_STYLE[status] ?? { label: status, bg: 'var(--line-strong)', fg: 'var(--ink)' };
  return (
    <span className="badge" style={{ background: style.bg, color: style.fg }}>
      {style.label}
    </span>
  );
}

/* ---------- Card ---------- */

export function Card({
  pad,
  flat,
  className = '',
  style,
  children,
}: {
  pad?: boolean;
  flat?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={[flat ? 'card--flat' : 'card', pad ? 'card--pad' : '', className].filter(Boolean).join(' ')}
      style={style}
    >
      {children}
    </div>
  );
}

/* ---------- Form fields ---------- */

export function Field({
  label,
  hint,
  error,
  children,
  trailing,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="field">
      {(label || trailing) && (
        <div className="row-between">
          {label && <span className="field__label">{label}</span>}
          {trailing}
        </div>
      )}
      {children}
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

export function Input({ small, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { small?: boolean }) {
  return <input className={`input${small ? ' input--sm' : ''} ${className}`.trim()} {...rest} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`textarea ${className}`.trim()} {...rest} />;
}

export function Toggle({
  on,
  onToggle,
  label,
  disabled,
}: {
  on: boolean;
  onToggle: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="toggle"
      data-on={on ? 'true' : 'false'}
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <span className="toggle__knob" />
    </button>
  );
}

/* ---------- Avatar ---------- */

export function Avatar({
  name,
  size = 38,
  background = 'var(--accent)',
  color = '#fff',
}: {
  name?: string | null;
  size?: number;
  background?: string;
  color?: string;
}) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background, color, fontSize: Math.round(size * 0.37) }}
    >
      {toInitials(name)}
    </span>
  );
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  width = 560,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: ReactNode;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal__scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" style={{ width }} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>
  );
}

/* ---------- Loading / empty / error ---------- */

export function Loading({ label = 'Đang tải…', inline }: { label?: string; inline?: boolean }) {
  return (
    <div className={`state${inline ? ' state--inline' : ''}`}>
      <span className="spinner spinner--lg" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <span className="state__title">{title}</span>
      {description && <span style={{ maxWidth: 460, textWrap: 'pretty' }}>{description}</span>}
      {action}
    </div>
  );
}

/** Renders a thrown error, surfacing the backend's own message and code. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = describeError(error);
  const code = error instanceof ApiError ? error.code : null;
  return (
    <div className="state state--error">
      <span className="state__title">Không tải được dữ liệu</span>
      <span style={{ maxWidth: 520, textWrap: 'pretty' }}>{message}</span>
      {code && <span className="mono" style={{ fontSize: 12, color: 'var(--ink-5)' }}>{code}</span>}
      {onRetry && (
        <Button variant="outline" size="xs" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    // Backend trả 401 cho cả phiên hết hạn (TOKEN_EXPIRED / ACCESS_TOKEN_EXPIRED)
    // lẫn sai email/mật khẩu. Bảo "đăng nhập lại" khi người dùng đang ở ngay form
    // đăng nhập thì vô nghĩa, nên để nguyên câu của backend cho trường hợp đó.
    if (error.status === 401) {
      if (error.code === 'INVALID_CREDENTIALS') return error.message;
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    if (error.status === 403) return 'Tài khoản của bạn không có quyền thực hiện thao tác này.';
    return error.message;
  }
  if (error instanceof TypeError) {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    return `Không kết nối được tới backend. Kiểm tra backend ở ${base} đã chạy chưa.`;
  }
  if (error instanceof Error) return error.message;
  return 'Đã xảy ra lỗi không xác định.';
}

export function Skeleton({ height = 16, width = '100%', radius }: { height?: number | string; width?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius }} />;
}

/** The hatched placeholder used wherever an image URL is missing. */
export function PosterBox({
  src,
  alt,
  width,
  height,
  radius = 14,
  background = '#d9ccf0',
  label = 'poster 2:3',
  className = '',
  style,
}: {
  src?: string | null;
  alt?: string;
  width?: number | string;
  height?: number | string;
  radius?: number;
  background?: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    width,
    height,
    borderRadius: radius,
    flex: 'none',
    overflow: 'hidden',
    ...style,
  };

  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? ''}
        className={className}
        style={{ ...base, objectFit: 'cover', display: 'block' }}
        loading="lazy"
      />
    );
  }

  return (
    <div className={`poster-ph ${className}`.trim()} style={{ ...base, background }} aria-label={alt}>
      {label}
    </div>
  );
}
