import { useState, useEffect, useCallback } from 'react';
import Select from 'react-select';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import {
  getBookableAssets, getDaySlots, createBooking,
  listBookings, cancelBooking,
} from '../../api/booking';

// react-select dark theme (same as allocation page)
const rsStyles = {
  control: (b, s) => ({
    ...b, background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${s.isFocused ? '#818cf8' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 8, boxShadow: 'none', minHeight: 40, cursor: 'pointer',
  }),
  menu: (b) => ({ ...b, background: '#1e1f30', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, zIndex: 9999 }),
  option: (b, s) => ({
    ...b, background: s.isSelected ? '#4f46e5' : s.isFocused ? 'rgba(129,140,248,0.15)' : 'transparent',
    color: '#f1f5f9', cursor: 'pointer',
  }),
  singleValue: (b) => ({ ...b, color: '#f1f5f9' }),
  input: (b) => ({ ...b, color: '#f1f5f9' }),
  placeholder: (b) => ({ ...b, color: '#64748b' }),
  indicatorSeparator: () => ({ display: 'none' }),
};
const rsTheme = (t) => ({ ...t, colors: { ...t.colors, primary: '#818cf8', primary25: 'rgba(129,140,248,0.15)' } });

function formatHour(h) {
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

function dateStr(d) { return d.toISOString().split('T')[0]; }

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Book Modal ─────────────────────────────────────────────────
function BookModal({ isOpen, onClose, assetId, assetLabel, selectedDate, onSuccess }) {
  const [startH, setStartH] = useState('9');
  const [startM, setStartM] = useState('00');
  const [endH, setEndH] = useState('10');
  const [endM, setEndM] = useState('00');
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => { if (isOpen) { setConflicts([]); setStartH('9'); setStartM('00'); setEndH('10'); setEndM('00'); } }, [isOpen]);

  async function handleBook() {
    if (!assetId) return;
    const day = dateStr(selectedDate);
    const start_time = `${day}T${startH.padStart(2, '0')}:${startM}:00`;
    const end_time = `${day}T${endH.padStart(2, '0')}:${endM}:00`;

    if (end_time <= start_time) { toast.error('End time must be after start time'); return; }

    setLoading(true); setConflicts([]);
    try {
      const res = await createBooking({ asset_id: assetId, start_time, end_time });
      if (res.data.conflict) {
        setConflicts(res.data.conflicting_bookings || []);
        toast.error(res.data.message || 'Slot conflict');
      } else {
        toast.success('Booking confirmed!');
        onSuccess(); onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Booking failed');
    } finally { setLoading(false); }
  }

  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8-20
  const mins = ['00', '30'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book a Slot" size="md"
      footer={<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={handleBook}>Book Slot</Button>
      </div>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
          Resource: <strong style={{ color: '#f1f5f9' }}>{assetLabel}</strong>
          <br />Date: <strong style={{ color: '#f1f5f9' }}>{selectedDate ? fmtDate(selectedDate) : ''}</strong>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Start</label>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <select className="af-input" value={startH} onChange={e => setStartH(e.target.value)}>
                {hours.map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
              </select>
              <select className="af-input" style={{ width: 70 }} value={startM} onChange={e => setStartM(e.target.value)}>
                {mins.map(m => <option key={m} value={m}>:{m}</option>)}
              </select>
            </div>
          </div>
          <span style={{ color: '#64748b', marginTop: 20 }}>→</span>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>End</label>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <select className="af-input" value={endH} onChange={e => setEndH(e.target.value)}>
                {hours.map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
              </select>
              <select className="af-input" style={{ width: 70 }} value={endM} onChange={e => setEndM(e.target.value)}>
                {mins.map(m => <option key={m} value={m}>:{m}</option>)}
              </select>
            </div>
          </div>
        </div>

        {conflicts.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ color: '#fca5a5', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 6px' }}>
              ⛔ Conflict — slot is unavailable
            </p>
            {conflicts.map(c => (
              <p key={c.id} style={{ color: '#f87171', fontSize: '0.78rem', margin: '2px 0' }}>
                {c.booked_by_name}: {new Date(c.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(c.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────────
const TABS = ['Day View', 'My Bookings'];

export default function BookingPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('Day View');

  // Resource picker
  const [bookableAssets, setBookableAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Slots
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // My bookings
  const [myBookings, setMyBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // Book modal
  const [bookOpen, setBookOpen] = useState(false);

  // Load bookable assets
  useEffect(() => {
    getBookableAssets().then(r => setBookableAssets(r.data)).catch(() => toast.error('Failed to load bookable assets'));
  }, []);

  // Load slots when asset or date changes
  const loadSlots = useCallback(() => {
    if (!selectedAsset) { setSlots([]); return; }
    setSlotsLoading(true);
    getDaySlots(selectedAsset.value, dateStr(selectedDate))
      .then(r => setSlots(r.data))
      .catch(() => toast.error('Failed to load slots'))
      .finally(() => setSlotsLoading(false));
  }, [selectedAsset, selectedDate]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  // Load my bookings
  const loadMyBookings = useCallback(() => {
    setBookingsLoading(true);
    listBookings()
      .then(r => setMyBookings(r.data))
      .catch(() => {})
      .finally(() => setBookingsLoading(false));
  }, []);

  useEffect(() => { if (tab === 'My Bookings') loadMyBookings(); }, [tab, loadMyBookings]);

  function prevDay() { setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; }); }
  function nextDay() { setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }); }
  function goToday() { setSelectedDate(new Date()); }

  async function handleCancel(id) {
    try {
      await cancelBooking(id);
      toast.success('Booking cancelled');
      loadMyBookings();
      loadSlots();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cancel failed');
    }
  }

  function handleBookSuccess() {
    loadSlots();
    loadMyBookings();
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1e1f30', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 },
      }} />

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>Resource Booking</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>Book shared resources like conference rooms and equipment</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', fontSize: '0.875rem', fontWeight: 500, background: 'transparent', border: 'none',
            borderBottom: `2px solid ${tab === t ? '#818cf8' : 'transparent'}`,
            color: tab === t ? '#818cf8' : '#94a3b8', cursor: 'pointer', marginBottom: -1,
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Day View' ? (
        <>
          {/* Resource Picker + Date Nav */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <label style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Resource</label>
              <Select
                options={bookableAssets.map(a => ({ value: a.id, label: `${a.tag} — ${a.name}` }))}
                value={selectedAsset} onChange={setSelectedAsset}
                placeholder={bookableAssets.length ? 'Select a bookable resource…' : 'No bookable assets found'}
                styles={rsStyles} theme={rsTheme} isClearable
              />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={prevDay} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>◀</button>
              <button onClick={goToday} style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)', color: '#818cf8', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Today</button>
              <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.9rem', minWidth: 120, textAlign: 'center' }}>
                {fmtDate(selectedDate)}
              </span>
              <button onClick={nextDay} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>▶</button>
            </div>
          </div>

          {/* Slot Grid */}
          {!selectedAsset ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
              Select a bookable resource to view availability
            </div>
          ) : slotsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="af-spinner" /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
              {slots.map((slot, i) => {
                const booked = slot.is_booked;
                return (
                  <div key={slot.hour} style={{
                    display: 'flex', alignItems: 'stretch', borderBottom: i < slots.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    {/* Time label */}
                    <div style={{
                      width: 70, flexShrink: 0, padding: '12px 10px', fontSize: '0.78rem', fontWeight: 600,
                      color: '#64748b', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      {formatHour(slot.hour)}
                    </div>
                    {/* Slot content */}
                    <div style={{
                      flex: 1, padding: '10px 14px', minHeight: 44,
                      background: booked ? 'rgba(59,130,246,0.12)' : 'transparent',
                      borderLeft: booked ? '3px solid #3b82f6' : '3px solid transparent',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      {booked ? (
                        <>
                          <span style={{ fontSize: '0.85rem', color: '#93c5fd', fontWeight: 500 }}>
                            Booked — {slot.booking.booked_by_name}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {new Date(slot.booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(slot.booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.2)' }}>Available</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Book button */}
          {selectedAsset && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem 0' }}>
              <Button onClick={() => setBookOpen(true)}>Book a Slot</Button>
            </div>
          )}
        </>
      ) : (
        /* My Bookings Tab */
        bookingsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="af-spinner" /></div>
        ) : myBookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
            No bookings yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {myBookings.map(b => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="af-assets__tag">{b.asset_tag}</span>
                    <span style={{ color: '#f1f5f9', fontSize: '0.875rem' }}>{b.asset_name}</span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 4 }}>
                    {new Date(b.start_time).toLocaleDateString()} · {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <Badge status={b.status}>{b.status}</Badge>
                {(b.status === 'upcoming' || b.status === 'ongoing') && (
                  <button onClick={() => handleCancel(b.id)}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      <BookModal
        isOpen={bookOpen} onClose={() => setBookOpen(false)}
        assetId={selectedAsset?.value} assetLabel={selectedAsset?.label}
        selectedDate={selectedDate} onSuccess={handleBookSuccess}
      />
    </div>
  );
}
