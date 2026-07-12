import './Card.css';

export default function Card({
  children,
  variant = 'default',
  padding = true,
  hover = true,
  glow,
  className = '',
  onClick,
  style,
  ...props
}) {
  return (
    <div
      className={[
        'af-card',
        `af-card--${variant}`,
        hover && 'af-card--hover',
        glow && `af-card--glow-${glow}`,
        padding && 'af-card--padded',
        onClick && 'af-card--clickable',
        className,
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

/** Stat card variant for KPI display */
export function StatCard({ label, value, icon, change, changeType = 'neutral', ...props }) {
  return (
    <Card variant="stat" {...props}>
      <div className="af-stat-card">
        <div className="af-stat-card__header">
          {icon && <span className="af-stat-card__icon">{icon}</span>}
          <span className="af-stat-card__label">{label}</span>
        </div>
        <div className="af-stat-card__value">{value}</div>
        {change !== undefined && (
          <div className={`af-stat-card__change af-stat-card__change--${changeType}`}>
            {changeType === 'up' && '↑ '}
            {changeType === 'down' && '↓ '}
            {change}
          </div>
        )}
      </div>
    </Card>
  );
}
