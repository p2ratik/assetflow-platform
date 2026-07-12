import { useState, useEffect, useCallback } from 'react';
import Select from 'react-select';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import {
  listAllocations, allocateAsset, returnAsset,
  createTransferRequest, listTransferRequests,
  approveTransfer, rejectTransfer,
  getUsers,
} from '../../api/allocation';
import { getAssets } from '../../api/assets';
import './AllocationPage.css';

// ── react-select dark theme shared config ──────────────────────
const rsStyles = {
  control: (b, s) => ({
    ...b,
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${s.isFocused ? '#818cf8' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 8,
    boxShadow: 'none',
    minHeight: 40,
    cursor: 'pointer',
  }),
  menu: (b) => ({
    ...b, background: '#1e1f30',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, zIndex: 9999,
  }),
  option: (b, s) => ({
    ...b,
    background: s.isSelected ? '#4f46e5' : s.isFocused ? 'rgba(129,140,248,0.15)' : 'transparent',
    color: '#f1f5f9', cursor: 'pointer',
  }),
  singleValue: (b) => ({ ...b, color: '#f1f5f9' }),
  input: (b) => ({ ...b, color: '#f1f5f9' }),
  placeholder: (b) => ({ ...b, color: '#64748b' }),
  indicatorSeparator: () => ({ display: 'none' }),
  noOptionsMessage: (b) => ({ ...b, color: '#64748b' }),
};

const rsTheme = (t) => ({
  ...t,
  colors: { ...t.colors, primary: '#818cf8', primary25: 'rgba(129,140,248,0.15)' },
});

// ── Shared form field wrapper ──────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div className="af-field">
      <label className="af-field__label">
        {label}{required && <span style={{ color: '#f87171', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Status badge helper ────────────────────────────────────────
function allocBadge(s) {
  return s === 'active' ? 'allocated' : s === 'returned' ? 'available' : 'lost';
}

// ── Conflict Banner ────────────────────────────────────────────
function ConflictBanner({ conflict, onTransfer }) {
  return (
    <div className="af-conflict-banner">
      <div>
        <p className="af-conflict-banner__title">⛔ Already Allocated to {conflict.held_by}</p>
        <p className="af-conflict-banner__sub">Direct re-allocation is blocked — submit a transfer request below.</p>
      </div>
      <button className="af-conflict-banner__cta" onClick={onTransfer}>
        Submit Transfer Request →
      </button>
    </div>
  );
}

// ── Allocate Modal ─────────────────────────────────────────────
function AllocateModal({ isOpen, onClose, users, assets, onSuccess }) {
  const [asset, setAsset] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [returnDate, setReturnDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [conflict, setConflict] = useState(null);

  const reset = () => { setAsset(null); setEmployee(null); setReturnDate(''); setReason(''); setConflict(null); };
  useEffect(() => { if (isOpen) reset(); }, [isOpen]);

  async function handleSubmit() {
    if (!asset) { toast.error('Please select an asset'); return; }
    if (!employee) { toast.error('Please select an employee'); return; }
    setLoading(true); setConflict(null);
    try {
      const res = await allocateAsset({
        asset_id: asset.value,
        employee_id: employee.value,
        expected_return_date: returnDate || undefined,
      });
      if (res.data.blocked) {
        setConflict(res.data);
      } else {
        toast.success(`✅ ${asset.label.split(' —')[0]} allocated to ${employee.label.split(' (')[0]}`);
        onSuccess();
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Allocation failed');
    } finally {
      setLoading(false);
    }
  }

  function openTransfer() {
    onClose();
    onSuccess({ openTransfer: true, assetId: asset?.value, assetTag: asset?.label?.split(' —')[0], assetName: asset?.label?.split('— ')[1]?.split(' (')[0] });
  }

  const availableAssets = assets.filter(a => a.status === 'Available');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Allocate Asset" size="md"
      footer={<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={handleSubmit}>Allocate Asset</Button>
      </div>}
    >
      <div className="af-form-stack">
        {conflict && <ConflictBanner conflict={conflict} onTransfer={openTransfer} />}

        <Field label="Asset" required>
          <Select
            options={availableAssets.map(a => ({ value: a.id, label: `${a.tag} — ${a.name} (${a.condition})` }))}
            value={asset} onChange={v => { setAsset(v); setConflict(null); }}
            placeholder={availableAssets.length ? `${availableAssets.length} available assets…` : 'No available assets'}
            styles={rsStyles} theme={rsTheme} isClearable
            noOptionsMessage={() => 'No available assets found'}
          />
          <small className="af-hint">Only Available assets shown</small>
        </Field>

        <Field label="Assign To" required>
          <Select
            options={users.map(u => ({ value: u.id, label: `${u.name} (${u.role})` }))}
            value={employee} onChange={setEmployee}
            placeholder={users.length ? `Search among ${users.length} users…` : 'Loading…'}
            styles={rsStyles} theme={rsTheme} isClearable
          />
        </Field>

        <Field label="Expected Return Date">
          <input className="af-input" type="date" value={returnDate}
            onChange={e => setReturnDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]} />
        </Field>

        <Field label="Reason / Notes">
          <textarea className="af-input af-textarea" rows={2} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Why is this asset being allocated? (optional)" />
        </Field>
      </div>
    </Modal>
  );
}

// ── Return Modal ───────────────────────────────────────────────
function ReturnModal({ isOpen, onClose, allocation, onSuccess }) {
  const [notes, setNotes] = useState('');
  const [condition, setCondition] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isOpen) { setNotes(''); setCondition(''); } }, [isOpen]);

  async function handleReturn() {
    if (!allocation) return;
    setLoading(true);
    try {
      await returnAsset(allocation.id, { checkin_notes: notes || undefined, condition: condition || undefined });
      toast.success(`✅ ${allocation.asset_tag} returned`);
      onSuccess(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Return failed');
    } finally { setLoading(false); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Return Asset" size="md"
      footer={<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={handleReturn}>Confirm Return</Button>
      </div>}
    >
      {allocation && (
        <div className="af-form-stack">
          <div className="af-return-card">
            <span className="af-assets__tag">{allocation.asset_tag}</span>
            <span>{allocation.asset_name}</span>
            <span className="af-muted">from {allocation.employee_name}</span>
          </div>
          <Field label="Condition on Return">
            <select className="af-input" value={condition} onChange={e => setCondition(e.target.value)}>
              <option value="">— Unchanged —</option>
              {['New','Good','Fair','Poor','Damaged'].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Check-in Notes">
            <textarea className="af-input af-textarea" rows={3} value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe condition, damage, accessories returned…" />
          </Field>
        </div>
      )}
    </Modal>
  );
}

// ── Transfer Modal ─────────────────────────────────────────────
function TransferModal({ isOpen, onClose, users, assets, prefillAsset, onSuccess }) {
  const [asset, setAsset] = useState(null);
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTarget(null); setReason('');
      if (prefillAsset) {
        setAsset({ value: prefillAsset.id, label: `${prefillAsset.tag} — ${prefillAsset.name || ''}` });
      } else { setAsset(null); }
    }
  }, [isOpen, prefillAsset]);

  async function handleSubmit() {
    if (!asset) { toast.error('Select an asset'); return; }
    if (!target) { toast.error('Select a target employee'); return; }
    setLoading(true);
    try {
      await createTransferRequest({ asset_id: asset.value, target_holder_id: target.value, notes: reason || undefined });
      toast.success('Transfer request submitted');
      onSuccess(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit transfer');
    } finally { setLoading(false); }
  }

  const allocatedAssets = assets.filter(a => a.status === 'Allocated');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Submit Transfer Request" size="md"
      footer={<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button loading={loading} onClick={handleSubmit}>Submit Request</Button>
      </div>}
    >
      <div className="af-form-stack">
        <Field label="Asset (currently allocated)" required>
          <Select
            options={allocatedAssets.map(a => ({ value: a.id, label: `${a.tag} — ${a.name}` }))}
            value={asset} onChange={setAsset}
            placeholder="Select allocated asset…"
            styles={rsStyles} theme={rsTheme}
            isDisabled={!!prefillAsset}
          />
        </Field>

        <Field label="Transfer To" required>
          <Select
            options={users.map(u => ({ value: u.id, label: `${u.name} (${u.role})` }))}
            value={target} onChange={setTarget}
            placeholder="Search target employee…"
            styles={rsStyles} theme={rsTheme} isClearable
          />
        </Field>

        <Field label="Reason" required>
          <textarea className="af-input af-textarea" rows={3} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Why is this transfer needed?" />
        </Field>
      </div>
    </Modal>
  );
}

// ── Reject Modal ───────────────────────────────────────────────
function RejectModal({ isOpen, onClose, transfer, onSuccess }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReject() {
    setLoading(true);
    try {
      await rejectTransfer(transfer.id, reason);
      toast.success('Transfer rejected');
      onSuccess(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setLoading(false); }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reject Transfer" size="sm"
      footer={<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" loading={loading} onClick={handleReject}>Reject</Button>
      </div>}
    >
      <div className="af-form-stack">
        <p className="af-muted" style={{ fontSize: '0.875rem' }}>
          Rejecting transfer of <strong style={{ color: '#f1f5f9' }}>{transfer?.asset_tag}</strong> → {transfer?.target_holder_name}
        </p>
        <Field label="Reason (optional)">
          <textarea className="af-input af-textarea" rows={3} value={reason}
            onChange={e => setReason(e.target.value)} placeholder="Reason for rejection…" />
        </Field>
      </div>
    </Modal>
  );
}

// ── Main Page ──────────────────────────────────────────────────
const TABS = ['Active', 'Overdue', 'History', 'Transfers'];

export default function AllocationPage() {
  const { user } = useAuth();
  const canMutate = ['admin', 'asset_manager'].includes(user?.role);

  const [tab, setTab] = useState('Active');
  const [allocations, setAllocations] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [users, setUsers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dropdownsLoading, setDropdownsLoading] = useState(true);

  // Modal states
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferPrefill, setTransferPrefill] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const loadAllocations = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, tRes] = await Promise.all([
        listAllocations(),
        canMutate ? listTransferRequests() : Promise.resolve({ data: [] }),
      ]);
      setAllocations(aRes.data);
      setTransfers(tRes.data);
    } catch (err) {
      toast.error('Failed to load allocation data');
      console.error('Allocation load error:', err);
    } finally {
      setLoading(false);
    }
  }, [canMutate]);

  // Load dropdown data separately — uses /api/users (any auth) + /api/assets
  useEffect(() => {
    setDropdownsLoading(true);

    getUsers()
      .then(r => { setUsers(r.data); console.log(`Loaded ${r.data.length} users`); })
      .catch(err => {
        console.error('Users load failed:', err.response?.status, err.response?.data);
        toast.error(`Could not load user list: ${err.response?.data?.detail || err.message}`);
      });

    getAssets({ per_page: 500 })
      .then(r => {
        const items = r.data.items || [];
        setAssets(items);
        console.log(`Loaded ${items.length} assets`);
      })
      .catch(err => {
        console.error('Assets load failed:', err.response?.status, err.response?.data);
        toast.error(`Could not load asset list: ${err.response?.data?.detail || err.message}`);
      })
      .finally(() => setDropdownsLoading(false));

    loadAllocations();
  }, [loadAllocations]);

  const today = new Date().toISOString().split('T')[0];

  const overdueList = allocations.filter(
    a => a.status === 'active' && a.expected_return_date && a.expected_return_date < today
  );
  const pendingTransfers = transfers.filter(t => t.status === 'requested');

  const filtered = tab === 'Active'
    ? allocations.filter(a => a.status === 'active' && (!a.expected_return_date || a.expected_return_date >= today))
    : tab === 'Overdue'
      ? overdueList
      : tab === 'History'
        ? allocations.filter(a => a.status === 'returned')
        : [];

  function handleAllocateSuccess(extra) {
    loadAllocations();
    if (extra?.openTransfer) {
      setTransferPrefill({ id: extra.assetId, tag: extra.assetTag, name: extra.assetName });
      setTransferOpen(true);
    }
  }

  async function handleApprove(id) {
    try {
      await approveTransfer(id);
      toast.success('Transfer approved');
      loadAllocations();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Approval failed');
    }
  }

  return (
    <div className="af-alloc-page">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1e1f30', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 },
      }} />

      {/* Header */}
      <div className="af-alloc-page__header">
        <div>
          <h1 className="af-alloc-page__title">Allocation & Transfer</h1>
          <p className="af-alloc-page__subtitle">
            {loading ? 'Loading…' : `${allocations.filter(a=>a.status==='active').length} active · ${overdueList.length} overdue`}
          </p>
        </div>
        {canMutate && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" onClick={() => { setTransferPrefill(null); setTransferOpen(true); }}>
              Transfer Request
            </Button>
            <Button onClick={() => setAllocateOpen(true)}>
              + Allocate Asset
            </Button>
          </div>
        )}
      </div>

      {/* Dropdown status debug */}
      {dropdownsLoading && (
        <p className="af-muted" style={{ fontSize: '0.8rem' }}>Loading dropdowns…</p>
      )}
      {!dropdownsLoading && (
        <p className="af-muted" style={{ fontSize: '0.8rem' }}>
          {users.length} users · {assets.length} assets loaded for forms
        </p>
      )}

      {/* Tabs */}
      <div className="af-alloc-tabs">
        {TABS.map(t => (
          <button key={t} className={`af-alloc-tab ${tab === t ? 'af-alloc-tab--active' : ''}`} onClick={() => setTab(t)}>
            {t}
            {t === 'Overdue' && overdueList.length > 0 && <span className="af-alloc-tab__badge">{overdueList.length}</span>}
            {t === 'Transfers' && pendingTransfers.length > 0 && <span className="af-alloc-tab__badge">{pendingTransfers.length}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="af-alloc-loading"><div className="af-spinner" /></div>
      ) : tab === 'Transfers' ? (
        <div className="af-transfer-list">
          {transfers.length === 0 ? (
            <div className="af-alloc-empty">No transfer requests found.</div>
          ) : transfers.map(tr => (
            <div key={tr.id} className="af-transfer-card">
              <div style={{ minWidth: 120 }}>
                <div className="af-assets__tag">{tr.asset_tag}</div>
                <div className="af-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>{tr.asset_name}</div>
              </div>
              <div className="af-transfer-card__flow">
                <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{tr.current_holder_name}</span>
                <span className="af-muted">→</span>
                <span style={{ color: '#818cf8', fontWeight: 600 }}>{tr.target_holder_name}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div className="af-muted" style={{ fontSize: '0.75rem' }}>
                  by {tr.requested_by_name} · {tr.created_at ? new Date(tr.created_at).toLocaleDateString() : ''}
                </div>
                {tr.notes && <p className="af-muted" style={{ fontSize: '0.78rem', fontStyle: 'italic', margin: '4px 0 0' }}>{tr.notes}</p>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <Badge status={tr.status === 'requested' ? 'reserved' : tr.status === 'approved' ? 'available' : 'lost'}>
                  {tr.status}
                </Badge>
                {canMutate && tr.status === 'requested' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="af-org__action-btn af-org__action-btn--edit" onClick={() => handleApprove(tr.id)}>Approve</button>
                    <button className="af-org__action-btn af-org__action-btn--deactivate" onClick={() => setRejectTarget(tr)}>Reject</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="af-alloc-empty">
          {tab === 'Overdue' ? '✅ No overdue returns — all clear!' : `No ${tab.toLowerCase()} allocations.`}
        </div>
      ) : (
        <div className="af-alloc-table-wrap">
          <table className="af-alloc-table">
            <thead>
              <tr>
                <th>Tag</th><th>Asset</th><th>Holder</th><th>Department</th>
                <th>Allocated</th><th>Due Date</th><th>Status</th>
                {canMutate && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const isOverdue = a.status === 'active' && a.expected_return_date && a.expected_return_date < today;
                return (
                  <tr key={a.id} className={isOverdue ? 'af-table-row--overdue' : ''}>
                    <td><span className="af-assets__tag">{a.asset_tag}</span></td>
                    <td>{a.asset_name}</td>
                    <td>{a.employee_name}</td>
                    <td>{a.department_name || <span className="af-muted">—</span>}</td>
                    <td className="af-muted">{a.allocated_at ? new Date(a.allocated_at).toLocaleDateString() : '—'}</td>
                    <td>
                      {a.expected_return_date
                        ? <span style={isOverdue ? { color: '#f87171', fontWeight: 600 } : {}}>{a.expected_return_date}</span>
                        : <span className="af-muted">—</span>}
                    </td>
                    <td><Badge status={allocBadge(a.status)}>{a.status}</Badge></td>
                    {canMutate && (
                      <td>
                        {a.status === 'active' && (
                          <button className="af-org__action-btn af-org__action-btn--edit" onClick={() => setReturnTarget(a)}>
                            Return
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <AllocateModal isOpen={allocateOpen} onClose={() => setAllocateOpen(false)}
        users={users} assets={assets} onSuccess={handleAllocateSuccess} />
      <ReturnModal isOpen={!!returnTarget} onClose={() => setReturnTarget(null)}
        allocation={returnTarget} onSuccess={loadAllocations} />
      <TransferModal isOpen={transferOpen} onClose={() => setTransferOpen(false)}
        users={users} assets={assets} prefillAsset={transferPrefill} onSuccess={loadAllocations} />
      <RejectModal isOpen={!!rejectTarget} onClose={() => setRejectTarget(null)}
        transfer={rejectTarget} onSuccess={loadAllocations} />
    </div>
  );
}
