import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import { getAssets, registerAsset, updateAsset, getAsset } from '../../api/assets';
import { getCategories, getDepartments } from '../../api/organization';
import './AssetsPage.css';

const CONDITION_OPTIONS = ['New', 'Good', 'Fair', 'Poor', 'Damaged'];

// Statuses that can be manually set (Allocated/Reserved are system-controlled)
const MANUAL_STATUS_OPTIONS = [
  { value: 'Available', label: 'Available' },
  { value: 'Under Maintenance', label: 'Under Maintenance' },
  { value: 'Lost', label: 'Lost' },
  { value: 'Retired', label: 'Retired' },
  { value: 'Disposed', label: 'Disposed' },
];

// All statuses for filtering
const ALL_STATUS_OPTIONS = [
  'Available', 'Allocated', 'Reserved', 'Under Maintenance', 'Lost', 'Retired', 'Disposed',
];

// ── Status color helper ────────────────────────────────────────
function statusVariant(s) {
  const map = {
    Available: 'available',
    Allocated: 'allocated',
    Reserved: 'reserved',
    'Under Maintenance': 'maintenance',
    Lost: 'lost',
    Retired: 'retired',
    Disposed: 'disposed',
  };
  return map[s] || 'default';
}

// ── Register / Edit Modal ──────────────────────────────────────
function AssetFormModal({ isOpen, onClose, editAsset, categories, onSuccess }) {
  const isEdit = !!editAsset;
  const [form, setForm] = useState({
    name: '', category_id: '', serial_number: '', acquisition_date: '',
    acquisition_cost: '', condition: 'New', location: '', is_bookable: false,
    status: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editAsset) {
        setForm({
          name: editAsset.name || '',
          category_id: editAsset.category_id || '',
          serial_number: editAsset.serial_number || '',
          acquisition_date: editAsset.acquisition_date || '',
          acquisition_cost: editAsset.acquisition_cost || '',
          condition: editAsset.condition || 'New',
          location: editAsset.location || '',
          is_bookable: editAsset.is_bookable || false,
          status: editAsset.status || '',
        });
      } else {
        setForm({
          name: '', category_id: categories[0]?.id || '',
          serial_number: '', acquisition_date: '',
          acquisition_cost: '', condition: 'New',
          location: '', is_bookable: false, status: '',
        });
      }
      setError('');
    }
  }, [isOpen, editAsset, categories]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Asset name is required.'); return; }
    if (!form.category_id) { setError('Please select a category.'); return; }
    setSubmitting(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      category_id: parseInt(form.category_id),
      serial_number: form.serial_number || undefined,
      acquisition_date: form.acquisition_date || undefined,
      acquisition_cost: form.acquisition_cost ? parseFloat(form.acquisition_cost) : undefined,
      condition: form.condition,
      location: form.location || undefined,
      is_bookable: form.is_bookable,
      ...(isEdit && form.status ? { status: form.status } : {}),
    };
    try {
      if (isEdit) {
        await updateAsset(editAsset.id, payload);
      } else {
        await registerAsset(payload);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save asset');
    } finally {
      setSubmitting(false);
    }
  }

  // Determine if current status is system-controlled (can't be manually changed)
  const currentStatusIsLocked = isEdit && ['Allocated', 'Reserved'].includes(editAsset?.status);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Asset — ${editAsset?.tag}` : 'Register New Asset'}
      size="lg"
      footer={
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={submitting} onClick={handleSubmit}>
            {isEdit ? 'Save Changes' : 'Register Asset'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="af-asset-form">
        {error && <div className="af-asset-form__error">⚠ {error}</div>}

        <div className="af-asset-form__row">
          <div className="af-asset-form__field af-asset-form__field--grow">
            <label htmlFor="af-name">Asset Name *</label>
            <input id="af-name" type="text" value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Dell XPS 15 Laptop" required />
          </div>
          <div className="af-asset-form__field">
            <label htmlFor="af-category">Category *</label>
            <select id="af-category" value={form.category_id}
              onChange={(e) => set('category_id', e.target.value)} required>
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="af-asset-form__row">
          <div className="af-asset-form__field">
            <label htmlFor="af-serial">Serial Number</label>
            <input id="af-serial" type="text" value={form.serial_number}
              onChange={(e) => set('serial_number', e.target.value)}
              placeholder="SN-XXX-001" />
          </div>
          <div className="af-asset-form__field">
            <label htmlFor="af-condition">Condition</label>
            <select id="af-condition" value={form.condition}
              onChange={(e) => set('condition', e.target.value)}>
              {CONDITION_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="af-asset-form__row">
          <div className="af-asset-form__field">
            <label htmlFor="af-date">Acquisition Date</label>
            <input id="af-date" type="date" value={form.acquisition_date}
              onChange={(e) => set('acquisition_date', e.target.value)} />
          </div>
          <div className="af-asset-form__field">
            <label htmlFor="af-cost">Acquisition Cost (₹)</label>
            <input id="af-cost" type="number" step="0.01" min="0" value={form.acquisition_cost}
              onChange={(e) => set('acquisition_cost', e.target.value)}
              placeholder="0.00" />
          </div>
        </div>

        <div className="af-asset-form__field">
          <label htmlFor="af-location">Location</label>
          <input id="af-location" type="text" value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="e.g. Engineering Bay A, Asset Room 1" />
        </div>

        {isEdit && (
          <div className="af-asset-form__field">
            <label htmlFor="af-status">Status</label>
            {currentStatusIsLocked ? (
              <div className="af-asset-form__locked-status">
                <span className="af-asset-form__locked-badge">
                  🔒 {editAsset.status} — set automatically by allocation/booking system
                </span>
              </div>
            ) : (
              <>
                <select id="af-status" value={form.status}
                  onChange={(e) => set('status', e.target.value)}>
                  <option value="">— Keep current ({editAsset?.status}) —</option>
                  {MANUAL_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <span className="af-asset-form__hint">
                  Allocated & Reserved are set automatically by the allocation/booking flows.
                </span>
              </>
            )}
          </div>
        )}

        <div className="af-asset-form__check">
          <input id="af-bookable" type="checkbox" checked={form.is_bookable}
            onChange={(e) => set('is_bookable', e.target.checked)} />
          <label htmlFor="af-bookable">
            Bookable resource <span className="af-asset-form__hint">(can be reserved via booking system)</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}

// ── Asset Detail Modal ─────────────────────────────────────────
function AssetDetailModal({ isOpen, onClose, assetId }) {
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && assetId) {
      setLoading(true);
      setAsset(null);
      getAsset(assetId)
        .then((r) => { setAsset(r.data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [isOpen, assetId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={asset ? `${asset.tag} — ${asset.name}` : 'Asset Detail'}
      size="lg"
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      {loading && <div className="af-asset-detail__loading"><div className="af-spinner" /></div>}
      {asset && !loading && (
        <div className="af-asset-detail">
          <div className="af-asset-detail__top">
            <div className="af-asset-detail__info">
              <div className="af-asset-detail__tag">{asset.tag}</div>
              <Badge status={statusVariant(asset.status)}>{asset.status}</Badge>
              {asset.is_bookable && <span className="af-asset-detail__bookable">📅 Bookable</span>}
            </div>
            {asset.qr_code && (
              <div className="af-asset-detail__qr-wrap">
                <img src={asset.qr_code} alt={`QR for ${asset.tag}`} className="af-asset-detail__qr" />
                <span className="af-asset-detail__qr-label">Scan to identify</span>
              </div>
            )}
          </div>

          <div className="af-asset-detail__grid">
            <DetailRow label="Category" value={asset.category_name} />
            <DetailRow label="Serial Number" value={asset.serial_number} />
            <DetailRow label="Condition" value={asset.condition} />
            <DetailRow label="Location" value={asset.location} />
            <DetailRow label="Acquisition Date" value={asset.acquisition_date} />
            <DetailRow label="Acquisition Cost" value={asset.acquisition_cost ? `₹${Number(asset.acquisition_cost).toLocaleString('en-IN')}` : undefined} />
            <DetailRow label="Bookable" value={asset.is_bookable ? 'Yes' : 'No'} />
          </div>

          {asset.photo_url && (
            <div className="af-asset-detail__photo-wrap">
              <img src={asset.photo_url} alt={asset.name} className="af-asset-detail__photo" />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="af-detail-row">
      <span className="af-detail-row__label">{label}</span>
      <span className="af-detail-row__value">{value || <span className="af-org__na">—</span>}</span>
    </div>
  );
}

// ── Main Assets Page ───────────────────────────────────────────
export default function AssetsPage() {
  const { user } = useAuth();
  const canMutate = ['admin', 'asset_manager'].includes(user?.role);

  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, per_page: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', category_id: '', status: '', department_id: '' });
  const searchTimeout = useRef(null);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [detailAssetId, setDetailAssetId] = useState(null);

  const load = useCallback(async (page = 1, f = filters) => {
    setLoading(true);
    try {
      const res = await getAssets({ ...f, page, per_page: 20 });
      setAssets(res.data.items);
      setPagination({ total: res.data.total, page: res.data.page, per_page: res.data.per_page, pages: res.data.pages });
    } catch { /* silently handle */ }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    // Load categories and departments for dropdowns
    Promise.all([getCategories(), getDepartments()]).then(([cats, depts]) => {
      setCategories(cats.data);
      setDepartments(depts.data);
    }).catch(() => {});
    load(1);
  }, []); // eslint-disable-line

  function handleSearch(val) {
    const newFilters = { ...filters, q: val };
    setFilters(newFilters);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => load(1, newFilters), 400);
  }

  function handleFilter(key, val) {
    const newFilters = { ...filters, [key]: val };
    setFilters(newFilters);
    load(1, newFilters);
  }

  function clearFilters() {
    const reset = { q: '', category_id: '', status: '', department_id: '' };
    setFilters(reset);
    load(1, reset);
  }

  const hasActiveFilters = filters.q || filters.category_id || filters.status || filters.department_id;

  const columns = [
    {
      key: 'tag', label: 'Tag', sortable: true,
      render: (v) => <span className="af-assets__tag">{v}</span>,
    },
    { key: 'name', label: 'Asset Name', sortable: true },
    { key: 'category_name', label: 'Category' },
    {
      key: 'condition', label: 'Condition',
      render: (v) => <Badge status={v === 'New' ? 'available' : v === 'Good' ? 'completed' : 'pending'}>{v}</Badge>,
    },
    {
      key: 'status', label: 'Status',
      render: (v) => <Badge status={statusVariant(v)}>{v}</Badge>,
    },
    { key: 'location', label: 'Location', render: (v) => v || <span className="af-org__na">—</span> },
    ...(canMutate ? [{
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button className="af-org__action-btn af-org__action-btn--edit"
            onClick={(e) => { e.stopPropagation(); setEditAsset(row); }}>
            Edit
          </button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="af-assets-page">
      {/* Header */}
      <div className="af-assets-page__header">
        <div>
          <h1 className="af-assets-page__title">Asset Directory</h1>
          <p className="af-assets-page__subtitle">
            {pagination.total} asset{pagination.total !== 1 ? 's' : ''} total
          </p>
        </div>
        {canMutate && (
          <Button onClick={() => setRegisterOpen(true)}>
            + Register Asset
          </Button>
        )}
      </div>

      {/* Filters bar */}
      <div className="af-assets-filters">
        <div className="af-assets-filters__search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Search tag, name, serial, location…"
            value={filters.q}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <select className="af-assets-filters__select"
          value={filters.category_id}
          onChange={(e) => handleFilter('category_id', e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select className="af-assets-filters__select"
          value={filters.status}
          onChange={(e) => handleFilter('status', e.target.value)}>
          <option value="">All Statuses</option>
          {ALL_STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>

        <select className="af-assets-filters__select"
          value={filters.department_id}
          onChange={(e) => handleFilter('department_id', e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        {hasActiveFilters && (
          <button className="af-assets-filters__clear" onClick={clearFilters}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="af-assets-page__loading"><div className="af-spinner" /></div>
      ) : (
        <>
          <Table
            columns={columns}
            data={assets}
            onRowClick={(row) => setDetailAssetId(row.id)}
            emptyMessage={
              hasActiveFilters
                ? 'No assets match these filters. Try adjusting or clearing them.'
                : canMutate
                  ? 'No assets yet. Click "+ Register Asset" to add your first asset.'
                  : 'No assets found.'
            }
          />
          {pagination.pages > 1 && (
            <div className="af-assets-pagination">
              <button disabled={pagination.page <= 1}
                onClick={() => load(pagination.page - 1)}
                className="af-assets-pagination__btn">← Prev</button>
              <span className="af-assets-pagination__info">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <button disabled={pagination.page >= pagination.pages}
                onClick={() => load(pagination.page + 1)}
                className="af-assets-pagination__btn">Next →</button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AssetFormModal
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        categories={categories}
        onSuccess={() => load(1)}
      />
      <AssetFormModal
        isOpen={!!editAsset}
        onClose={() => setEditAsset(null)}
        editAsset={editAsset}
        categories={categories}
        onSuccess={() => { load(pagination.page); setEditAsset(null); }}
      />
      <AssetDetailModal
        isOpen={!!detailAssetId}
        onClose={() => setDetailAssetId(null)}
        assetId={detailAssetId}
      />
    </div>
  );
}
