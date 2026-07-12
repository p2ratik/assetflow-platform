import { useRef } from 'react';
import './Button.css';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  onClick,
  type = 'button',
  ...props
}) {
  const btnRef = useRef(null);

  function handleClick(e) {
    if (disabled || loading) return;

    // Ripple effect
    const btn = btnRef.current;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);

    onClick?.(e);
  }

  return (
    <button
      ref={btnRef}
      type={type}
      className={[
        'af-btn',
        `af-btn--${variant}`,
        `af-btn--${size}`,
        fullWidth && 'af-btn--full',
        loading && 'af-btn--loading',
        disabled && 'af-btn--disabled',
      ].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      {loading && (
        <span className="af-btn__spinner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" />
          </svg>
        </span>
      )}
      {icon && !loading && <span className="af-btn__icon">{icon}</span>}
      <span className="af-btn__label">{children}</span>
    </button>
  );
}
