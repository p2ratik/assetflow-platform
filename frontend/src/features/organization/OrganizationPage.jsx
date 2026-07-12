import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import {
  getDepartments, createDepartment, updateDepartment, deactivateDepartment,
  getCategories, createCategory, updateCategory, deactivateCategory,
  getEmployees, updateEmployee,
} from '../../api/organization';
import './OrganizationPage.css';

const ROLE_OPTIONS = [
  { value: 'employee', label: 'Employee' },
  { value: 'dept_head', label: 'Department Head' },
  { value: 'asset_manager', label: 'Asset Manager' },
  { value: 'admin', label: 'Admin' },
];

// ── Departments Tab ────────────────────────────────────────────
function DepartmentsTab({ isAdmin }) {
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', head_id: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [employees, setEmployees] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, e] = await Promise.all([getDepartments(), getEmployees()]);
      setDepts(d.data);
      setEmployees(e.data);
    } catch { /* handled below */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', head_id: '' });
    setError('');
    setModalOpen(true);
  }

  function openEdit(dept) {
    setEditing(dept);
    setForm({ name: dept.name, head_id: dept.head_id || '' });
    setError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const payload = {
      name: form.name,
      head_id: form.head_id ? parseInt(form.head_id) : null,
    };
    try {
      if (editing) {
        await updateDepartment(editing.id, payload);
      } else {
        await createDepartment(payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save department');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(dept) {
    if (!window.confirm(`Deactivate department "${dept.name}"? Members will remain but the department will be hidden.`)) return;
    try {
      await deactivateDepartment(dept.id);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to deactivate');
    }
  }

  const columns = [
    { key: 'name', label: 'Department', sortable: true },
    { key: 'head_name', label: 'Head', render: (v) => v || <span className="af-org__na">—</span> },
    { key: 'status', label: 'Status', render: (v) => <Badge status={v}>{v}</Badge> },
    ...(isAdmin ? [{
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <div className="af-org__actions">
          <button className="af-org__action-btn af-org__action-btn--edit" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>Edit</button>
          <button className="af-org__action-btn af-org__action-btn--del" onClick={(e) => { e.stopPropagation(); handleDeactivate(row); }}>Deactivate</button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="af-org-tab">
      <div className="af-org-tab__header">
        <h2 className="af-org-tab__title">Departments <span className="af-org-tab__count">{depts.length}</span></h2>
        {isAdmin && <Button size="sm" onClick={openCreate}>+ New Department</Button>}
      </div>

      {loading ? <div className="af-org-loading"><div className="af-spinner" /></div> : (
        <Table columns={columns} data={depts} emptyMessage="No departments yet." />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Department' : 'New Department'}
        footer={
          <div className="af-modal-footer-row">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={submitting} onClick={handleSubmit}>
              {editing ? 'Save Changes' : 'Create Department'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="af-org-form">
          {error && <div className="af-org-form__error">⚠ {error}</div>}
          <div className="af-org-form__field">
            <label htmlFor="dept-name">Department Name *</label>
            <input id="dept-name" type="text" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Engineering" required />
          </div>
          <div className="af-org-form__field">
            <label htmlFor="dept-head">Department Head</label>
            <select id="dept-head" value={form.head_id}
              onChange={(e) => setForm({ ...form, head_id: e.target.value })}>
              <option value="">— None —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ── Categories Tab ─────────────────────────────────────────────
function CategoriesTab({ isAdmin }) {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', custom_fields_str: '{}' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [jsonError, setJsonError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCategories(isAdmin);
      setCats(res.data);
    } catch { /* handled below */ }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', custom_fields_str: '{\n  \n}' });
    setError('');
    setJsonError('');
    setModalOpen(true);
  }

  function openEdit(cat) {
    setEditing(cat);
    setForm({
      name: cat.name,
      custom_fields_str: JSON.stringify(cat.custom_fields || {}, null, 2),
    });
    setError('');
    setJsonError('');
    setModalOpen(true);
  }

  function validateJson(str) {
    try { JSON.parse(str); setJsonError(''); return true; }
    catch (e) { setJsonError('Invalid JSON: ' + e.message); return false; }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateJson(form.custom_fields_str)) return;
    setSubmitting(true);
    setError('');
    const payload = {
      name: form.name,
      custom_fields: JSON.parse(form.custom_fields_str),
    };
    try {
      if (editing) {
        await updateCategory(editing.id, payload);
      } else {
        await createCategory(payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(cat) {
    if (!window.confirm(`Deactivate category "${cat.name}"? Existing assets will keep this category but it won't be available for new assets.`)) return;
    try {
      await deactivateCategory(cat.id);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to deactivate');
    }
  }

  const columns = [
    { key: 'name', label: 'Category', sortable: true },
    {
      key: 'custom_fields',
      label: 'Custom Fields',
      sortable: false,
      render: (v) => {
        const keys = Object.keys(v || {});
        return keys.length ? (
          <div className="af-org__fields">{keys.map((k) => (
            <span key={k} className="af-org__field-chip">{k}</span>
          ))}</div>
        ) : <span className="af-org__na">—</span>;
      },
    },
    { key: 'status', label: 'Status', render: (v) => <Badge status={v}>{v}</Badge> },
    ...(isAdmin ? [{
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <div className="af-org__actions">
          <button className="af-org__action-btn af-org__action-btn--edit" onClick={(e) => { e.stopPropagation(); openEdit(row); }}>Edit</button>
          {row.status === 'active' && (
            <button className="af-org__action-btn af-org__action-btn--del" onClick={(e) => { e.stopPropagation(); handleDeactivate(row); }}>Deactivate</button>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="af-org-tab">
      <div className="af-org-tab__header">
        <h2 className="af-org-tab__title">Categories <span className="af-org-tab__count">{cats.filter(c => c.status === 'active').length}</span></h2>
        {isAdmin && <Button size="sm" onClick={openCreate}>+ New Category</Button>}
      </div>

      {loading ? <div className="af-org-loading"><div className="af-spinner" /></div> : (
        <Table columns={columns} data={cats} emptyMessage="No categories yet." />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Category' : 'New Category'} size="lg"
        footer={
          <div className="af-modal-footer-row">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={submitting} onClick={handleSubmit} disabled={!!jsonError}>
              {editing ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="af-org-form">
          {error && <div className="af-org-form__error">⚠ {error}</div>}
          <div className="af-org-form__field">
            <label htmlFor="cat-name">Category Name *</label>
            <input id="cat-name" type="text" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Laptop" required />
          </div>
          <div className="af-org-form__field">
            <label htmlFor="cat-fields">
              Custom Fields (JSON)
              <span className="af-org-form__hint"> — keys become field names for assets of this type</span>
            </label>
            <textarea
              id="cat-fields"
              rows={6}
              value={form.custom_fields_str}
              onChange={(e) => { setForm({ ...form, custom_fields_str: e.target.value }); validateJson(e.target.value); }}
              className={`af-org-form__textarea ${jsonError ? 'af-org-form__textarea--error' : ''}`}
              spellCheck={false}
            />
            {jsonError && <span className="af-org-form__json-error">{jsonError}</span>}
            <span className="af-org-form__hint">Example: {"{"} "warranty_months": "integer", "brand": "string" {"}"}</span>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ── Employees Tab ──────────────────────────────────────────────
function EmployeesTab({ isAdmin, currentUserId }) {
  const [employees, setEmployees] = useState([]);
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ role: '', department_id: '', status: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, d] = await Promise.all([getEmployees(), getDepartments()]);
      setEmployees(e.data);
      setDepts(d.data);
    } catch { /* handled below */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(emp) {
    setEditing(emp);
    setForm({
      role: emp.role,
      department_id: emp.department_id ? String(emp.department_id) : '',
      status: emp.status,
    });
    setError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const payload = {
      role: form.role || undefined,
      department_id: form.department_id ? parseInt(form.department_id) : undefined,
      status: form.status || undefined,
    };
    try {
      await updateEmployee(editing.id, payload);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update employee');
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = employees.filter((e) =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: 'name', label: 'Name', sortable: true,
      render: (v, row) => (
        <div className="af-org__emp-name">
          <div className="af-org__emp-avatar">{v?.charAt(0)?.toUpperCase()}</div>
          <div>
            <div>{v} {row.id === currentUserId && <span className="af-org__you">you</span>}</div>
            <div className="af-org__emp-email">{row.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'role', label: 'Role', render: (v) => <Badge status={v === 'admin' ? 'approved' : v === 'asset_manager' ? 'ongoing' : 'pending'}>{v?.replace('_', ' ')}</Badge> },
    { key: 'department_name', label: 'Department', render: (v) => v || <span className="af-org__na">—</span> },
    { key: 'status', label: 'Status', render: (v) => <Badge status={v}>{v}</Badge> },
    ...(isAdmin ? [{
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <button className="af-org__action-btn af-org__action-btn--edit"
          onClick={(e) => { e.stopPropagation(); openEdit(row); }}>
          Edit
        </button>
      ),
    }] : []),
  ];

  return (
    <div className="af-org-tab">
      <div className="af-org-tab__header">
        <h2 className="af-org-tab__title">Employees <span className="af-org-tab__count">{employees.length}</span></h2>
        <input
          className="af-org-tab__search"
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? <div className="af-org-loading"><div className="af-spinner" /></div> : (
        <Table columns={columns} data={filtered} emptyMessage="No employees found." />
      )}

      {isAdmin && (
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
          title={`Edit: ${editing?.name}`}
          footer={
            <div className="af-modal-footer-row">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button loading={submitting} onClick={handleSubmit}>Save Changes</Button>
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="af-org-form">
            {error && <div className="af-org-form__error">⚠ {error}</div>}
            <div className="af-org-form__note">
              Role elevation is restricted to Admin. Changes take effect immediately.
            </div>
            <div className="af-org-form__field">
              <label htmlFor="emp-role">Role *</label>
              <select id="emp-role" value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })} required>
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="af-org-form__field">
              <label htmlFor="emp-dept">Department</label>
              <select id="emp-dept" value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">— No Department —</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="af-org-form__field">
              <label htmlFor="emp-status">Status</label>
              <select id="emp-status" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
const TABS = ['Departments', 'Categories', 'Employees'];

export default function OrganizationPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Departments');
  const isAdmin = user?.role === 'admin';

  return (
    <div className="af-org-page">
      <div className="af-org-page__header">
        <h1 className="af-org-page__title">Organization Setup</h1>
        <p className="af-org-page__subtitle">
          Manage departments, asset categories, and team roles.
        </p>
      </div>

      <div className="af-org-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`af-org-tab-btn ${activeTab === tab ? 'af-org-tab-btn--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="af-org-content">
        {activeTab === 'Departments' && <DepartmentsTab isAdmin={isAdmin} />}
        {activeTab === 'Categories' && <CategoriesTab isAdmin={isAdmin} />}
        {activeTab === 'Employees' && (
          <EmployeesTab isAdmin={isAdmin} currentUserId={user?.id} />
        )}
      </div>
    </div>
  );
}
