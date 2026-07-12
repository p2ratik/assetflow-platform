import { useMemo } from 'react';
import './CalendarGrid.css';

/**
 * CalendarGrid — weekly time-slot grid for resource booking.
 *
 * Props:
 *   - slots: Array of { id, resourceName, dayIndex (0=Mon), hour (0-23), status }
 *   - bookings: Array of { id, resourceName, startHour, endHour, dayIndex, label, status }
 *   - startHour / endHour: visible hour range (default 8-18)
 *   - days: array of day labels (default Mon-Fri)
 *   - onSlotClick: (dayIndex, hour) => void
 */
export default function CalendarGrid({
  bookings = [],
  startHour = 8,
  endHour = 18,
  days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  onSlotClick,
  className = '',
}) {
  const hours = useMemo(() => {
    const h = [];
    for (let i = startHour; i < endHour; i++) h.push(i);
    return h;
  }, [startHour, endHour]);

  // Map bookings to grid cells
  const bookingMap = useMemo(() => {
    const map = {};
    bookings.forEach((b) => {
      for (let h = b.startHour; h < b.endHour; h++) {
        const key = `${b.dayIndex}-${h}`;
        map[key] = b;
      }
    });
    return map;
  }, [bookings]);

  function formatHour(h) {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${display} ${ampm}`;
  }

  return (
    <div className={`af-cal-grid ${className}`}>
      {/* Header row */}
      <div className="af-cal-grid__header">
        <div className="af-cal-grid__time-label" />
        {days.map((day, i) => (
          <div key={i} className="af-cal-grid__day-label">{day}</div>
        ))}
      </div>

      {/* Time rows */}
      <div className="af-cal-grid__body">
        {hours.map((hour) => (
          <div key={hour} className="af-cal-grid__row">
            <div className="af-cal-grid__time-label">
              {formatHour(hour)}
            </div>
            {days.map((_, dayIdx) => {
              const key = `${dayIdx}-${hour}`;
              const booking = bookingMap[key];
              const isBooked = !!booking;
              const isConflict = booking?.status === 'conflict';
              const isStart = booking && booking.startHour === hour;

              return (
                <div
                  key={key}
                  className={[
                    'af-cal-grid__cell',
                    isBooked && 'af-cal-grid__cell--booked',
                    isConflict && 'af-cal-grid__cell--conflict',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onSlotClick?.(dayIdx, hour)}
                  title={
                    isBooked
                      ? `${booking.label || 'Booked'} (${formatHour(booking.startHour)} - ${formatHour(booking.endHour)})`
                      : `Available — ${days[dayIdx]} ${formatHour(hour)}`
                  }
                >
                  {isStart && booking.label && (
                    <span className="af-cal-grid__booking-label">
                      {booking.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
