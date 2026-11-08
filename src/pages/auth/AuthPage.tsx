import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/api/endpoints';
import { Button, Field, Input, Segmented, describeError } from '@/components/ui';
import { Logo } from '@/components/layout/SiteLayout';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { mmss } from '@/lib/format';
import './auth.css';

type Tab = 'login' | 'register' | 'forgot';

/** Backend rate-limits a resend to one per 60 seconds (docs/api/01-auth.md). */
const RESEND_COOLDOWN = 60;

function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setInterval(() => setLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [left]);
  return { left, start: () => setLeft(RESEND_COOLDOWN) };
}

/** Six-box OTP control driven by a single transparent input. */
function OtpInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="otp" onClick={() => ref.current?.focus()}>
      {Array.from({ length: 6 }, (_, index) => (
        <div
          className="otp__box"
          key={index}
          data-filled={Boolean(value[index])}
          data-cursor={index === value.length}
        >
          {value[index] ?? ''}
        </div>
      ))}
      <input
        ref={ref}
        className="otp__input"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        aria-label="Mã OTP 6 số"
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
      />
    </div>
  );
}

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    alnum: /[a-zA-Z]/.test(password) && /\d/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };
}

export default function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { login, register, isAuthenticated } = useAuth();

  const [tab, setTab] = useState<Tab>('login');
  const redirect = params.get('redirect') || '/';

  // Already signed in → go straight where the user was headed.
  useEffect(() => {
    if (isAuthenticated) navigate(redirect, { replace: true });
  }, [isAuthenticated, navigate, redirect]);

  return (
    <div className="auth">
      <aside className="auth__aside" style={{ backgroundColor: '#f2c9b8' }}>
        <Logo />
        <div className="stack" style={{ gap: 16 }}>
          <span className="auth__headline">
            Ghế đẹp
            <br />
            đang chờ
            <br />
            bạn.
          </span>
          <span className="auth__sub">
            Giữ ghế, thanh toán và nhận vé QR trong vài phút. Tích điểm lên hạng GOLD, DIAMOND.
          </span>
        </div>
      </aside>

      <div className="auth__panel">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'login', label: 'Đăng nhập' },
            { value: 'register', label: 'Đăng ký' },
            { value: 'forgot', label: 'Quên mật khẩu' },
          ]}
        />

        {tab === 'login' && (
          <LoginForm
            onForgot={() => setTab('forgot')}
            onSubmit={async (email, password) => {
              await login(email, password);
              toast.success('Đăng nhập thành công.');
              navigate(redirect, { replace: true });
            }}
          />
        )}

        {tab === 'register' && (
          <RegisterForm
            onDone={() => {
              toast.success('Tạo tài khoản thành công.');
              navigate(redirect, { replace: true });
            }}
            onRegister={register}
          />
        )}

        {tab === 'forgot' && <ForgotForm onDone={() => setTab('login')} />}

        <span className="note">
          Bằng việc tiếp tục, bạn đồng ý với điều khoản sử dụng của Movix.{' '}
          <Link to="/">Về trang chủ</Link>
        </span>
      </div>
    </div>
  );
}

/* ---------- Login ---------- */

function LoginForm({
  onSubmit,
  onForgot,
}: {
  onSubmit: (email: string, password: string) => Promise<void>;
  onForgot: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit(email.trim(), password);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth__form" onSubmit={submit}>
      <h1 className="auth__title">Chào mừng trở lại</h1>

      <Field label="Email">
        <Input
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      <Field
        label="Mật khẩu"
        trailing={
          <button
            type="button"
            onClick={onForgot}
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}
          >
            Quên mật khẩu?
          </button>
        }
        error={error}
      >
        <Input
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={error ? 'true' : undefined}
        />
      </Field>

      <Button type="submit" size="md" block loading={busy} style={{ height: 54 }}>
        Đăng nhập
      </Button>

      <span className="auth__or">hoặc</span>

      <Button
        type="button"
        variant="outline"
        size="md"
        block
        style={{ height: 54 }}
        onClick={() =>
          setError(
            'Đăng nhập Google cần Google Identity client-id. Backend đã có POST /api/v1/auth/google — truyền idToken vào authApi.googleLogin.',
          )
        }
      >
        Tiếp tục với Google
      </Button>
    </form>
  );
}

/* ---------- Register (OTP) ---------- */

function RegisterForm({
  onRegister,
  onDone,
}: {
  onRegister: (payload: {
    email: string;
    password: string;
    name: string;
    otp: string;
    phone?: string;
  }) => Promise<unknown>;
  onDone: () => void;
}) {
  const toast = useToast();
  const cooldown = useCooldown();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendOtp() {
    setError(null);
    if (!email.trim()) {
      setError('Nhập email trước khi gửi mã.');
      return;
    }
    setBusy(true);
    try {
      await authApi.sendRegisterOtp(email.trim());
      setOtpSent(true);
      cooldown.start();
      toast.success('Đã gửi mã OTP tới email của bạn.');
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onRegister({
        email: email.trim(),
        password,
        name: name.trim(),
        otp,
        phone: phone.trim() || undefined,
      });
      onDone();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  const ready = otp.length === 6 && name.trim() && email.trim() && password.length >= 8;

  return (
    <form className="auth__form" onSubmit={submit}>
      <h1 className="auth__title">Tạo tài khoản</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Họ tên">
          <Input
            required
            minLength={2}
            maxLength={100}
            placeholder="Nguyễn Minh Hoàng"
            value={name}
            onChange={(event) => setName(event.target.value)}
            style={{ height: 48 }}
          />
        </Field>
        <Field label="Điện thoại (tùy chọn)">
          <Input
            placeholder="0901 234 567"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            style={{ height: 48 }}
          />
        </Field>
      </div>

      <Field label="Email">
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={{ height: 48 }}
          />
          <Button
            type="button"
            variant="outline"
            size="xs"
            style={{ height: 48, flex: 'none' }}
            disabled={cooldown.left > 0 || busy}
            onClick={() => void sendOtp()}
          >
            {cooldown.left > 0 ? mmss(cooldown.left) : otpSent ? 'Gửi lại' : 'Gửi mã'}
          </Button>
        </div>
      </Field>

      <Field
        label={
          cooldown.left > 0
            ? `Mã OTP 6 số · gửi lại sau ${mmss(cooldown.left)}`
            : 'Mã OTP 6 số'
        }
        hint={otpSent ? 'Mã có hiệu lực 5 phút và chỉ dùng một lần.' : 'Bấm “Gửi mã” để nhận OTP.'}
      >
        <OtpInput value={otp} onChange={setOtp} />
      </Field>

      <Field label="Mật khẩu" error={error} hint="Ít nhất 8 ký tự.">
        <Input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••••"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={{ height: 48 }}
        />
      </Field>

      <Button
        type="submit"
        size="md"
        block
        style={{ height: 54 }}
        variant={ready ? 'accent' : 'quiet'}
        disabled={!ready}
        loading={busy}
      >
        Tạo tài khoản
      </Button>
    </form>
  );
}

/* ---------- Forgot password ---------- */

function ForgotForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const cooldown = useCooldown();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checks = passwordChecks(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="auth__form"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 0) {
          const trimmedEmail = email.trim();
          if (!trimmedEmail) return;
          // Chuyển ngay sang bước nhập OTP để người dùng không phải chờ SMTP gửi email
          setError(null);
          setStep(1);
          setOtp('');
          cooldown.start();
          toast.show('Đang gửi mã OTP đến email của bạn...');
          void authApi
            .sendOtp(trimmedEmail)
            .then(() => {
              toast.success('Đã gửi mã OTP tới email của bạn. Vui lòng kiểm tra hộp thư.');
            })
            .catch((caught) => {
              const err = describeError(caught);
              setError(err);
              toast.error(err);
            });
        } else if (step === 1) {
          void run(async () => {
            const result = await authApi.fpVerifyOtp(email.trim(), otp);
            // Backend trả về FP_VerifyOtpResponseOTP chứa trường `token`
            const token = result?.token || result?.resetToken;
            if (!token) {
              throw new Error('Xác thực OTP thất bại hoặc mã OTP không hợp lệ. Vui lòng thử lại.');
            }
            setResetToken(token);
            setStep(2);
            toast.success('Xác thực OTP thành công. Vui lòng thiết lập mật khẩu mới.');
          });
        } else {
          void run(async () => {
            if (!resetToken) {
              throw new Error('Không tìm thấy mã xác thực (reset token). Vui lòng thực hiện lại từ bước 1.');
            }
            await authApi.fpChangePassword(email.trim(), password, resetToken);
            toast.success('Đổi mật khẩu thành công! Hãy đăng nhập lại.');
            onDone();
          });
        }
      }}
    >
      <div className="fpsteps">
        {['Email', 'Mã OTP', 'Mật khẩu mới'].map((label, index) => (
          <div
            className="fpstep"
            key={label}
            data-state={index < step ? 'done' : index === step ? 'current' : 'todo'}
          >
            <span className="fpstep__bar" />
            <span className="fpstep__label">{label}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <>
          <h1 className="auth__title">Quên mật khẩu</h1>
          <Field label="Email" error={error} hint="Chúng tôi sẽ gửi mã OTP 6 số tới email này.">
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <Button type="submit" size="md" block style={{ height: 54 }}>
            Gửi mã OTP
          </Button>
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="auth__title">Nhập mã OTP</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: '-6px 0 10px' }}>
            Mã OTP 6 số đang được gửi tới: <strong style={{ color: 'var(--ink)' }}>{email}</strong>{' '}
            <button
              type="button"
              onClick={() => {
                setStep(0);
                setOtp('');
                setError(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: 13,
                marginLeft: 4,
              }}
            >
              (Đổi email)
            </button>
          </p>
          <Field
            label={cooldown.left > 0 ? `Mã OTP · gửi lại sau ${mmss(cooldown.left)}` : 'Mã OTP 6 số'}
            error={error}
          >
            <OtpInput value={otp} onChange={setOtp} />
          </Field>
          <Button type="submit" size="md" block style={{ height: 54 }} disabled={otp.length !== 6} loading={busy}>
            Xác thực
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={cooldown.left > 0 || busy}
            onClick={() => {
              cooldown.start();
              setError(null);
              toast.show('Đang gửi lại mã OTP...');
              void authApi
                .sendOtp(email.trim())
                .then(() => toast.success('Đã gửi lại mã OTP thành công.'))
                .catch((caught) => {
                  const err = describeError(caught);
                  setError(err);
                  toast.error(err);
                });
            }}
          >
            {cooldown.left > 0 ? `Gửi lại sau ${mmss(cooldown.left)}` : 'Gửi lại mã OTP'}
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="auth__title">Mật khẩu mới</h1>
          <Field label="Mật khẩu mới">
            <Input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••"
              style={{ height: 50 }}
            />
          </Field>
          <Field label="Nhập lại" error={mismatch ? 'Mật khẩu nhập lại chưa khớp.' : error}>
            <Input
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="••••••••••"
              aria-invalid={mismatch ? 'true' : undefined}
              style={{ height: 50 }}
            />
          </Field>
          <div className="pw-rules">
            <span>
              <b className={checks.length ? 'pw-rules__ok' : undefined}>{checks.length ? '✓' : '○'}</b> Ít nhất 8
              ký tự
            </span>
            <span>
              <b className={checks.alnum ? 'pw-rules__ok' : undefined}>{checks.alnum ? '✓' : '○'}</b> Có chữ và số
            </span>
            <span style={{ color: checks.special ? 'var(--ok)' : 'var(--ink-5)' }}>
              {checks.special ? '✓' : '○'} Ký tự đặc biệt
            </span>
          </div>
          <Button
            type="submit"
            size="md"
            block
            style={{ height: 54 }}
            variant={checks.length && checks.alnum && !mismatch ? 'accent' : 'quiet'}
            disabled={!checks.length || !checks.alnum || mismatch || !confirm}
            loading={busy}
          >
            Đổi mật khẩu
          </Button>
        </>
      )}
    </form>
  );
}
