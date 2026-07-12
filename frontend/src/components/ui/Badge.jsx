import './Badge.css';

const STATUS_MAP = {
  'Available': 'available',
  'Allocated': 'allocated',
  'Reserved': 'reserved',
  'Under Maintenance': 'maintenance',
  'Lost': 'lost',
  'Retired': 'retired',
  'Disposed': 'disposed',
  // Priority
  'low': 'low',
  'medium': 'medium',
  'high': 'high',
  'critical': 'critical',
  // General
  'active': 'available',
  'pending': 'allocated',
  'approved': 'available',
  'rejected': 'lost',
  'resolved': 'available',
  'open': 'reserved',
  'closed': 'retired',
  // Booking
  'upcoming': 'reserved',
  'ongoing': 'allocated',
  'completed': 'available',
  'cancelled': 'retired',
};

export default function Badge({
  children,
  status,
  variant = 'solid',
  size = 'md',
  dot = true,
  className = '',
}) {
  const colorKey = STATUS_MAP[status] || STATUS_MAP[children] || 'available';

  return (
    <span
      className={[
        'af-badge',
        `af-badge--${variant}`,
        `af-badge--${size}`,
        `af-badge--${colorKey}`,
        className,
      ].filter(Boolean).join(' ')}
    >
      {dot && variant !== 'outline' && <span className="af-badge__dot" />}
      <span className="af-badge__text">{children || status}</span>
    </span>
  );
}
