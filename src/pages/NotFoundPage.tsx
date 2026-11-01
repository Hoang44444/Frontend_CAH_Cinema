import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="guard">
      <div className="guard__box">
        <span className="display" style={{ fontSize: 96, lineHeight: 0.85 }}>
          404
        </span>
        <p style={{ color: 'var(--ink-4)' }}>Không tìm thấy trang bạn yêu cầu.</p>
        <Link to="/" className="btn btn--accent btn--md" style={{ color: '#fff' }}>
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
