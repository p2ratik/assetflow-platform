import { useCallback, useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { getAssets } from '../../api/assets';
import { getUsers } from '../../api/allocation';
import {
  approveMaintenanceRequest,
  assignMaintenanceTechnician,
  createMaintenanceRequest,
  listMaintenanceRequests,
  rejectMaintenanceRequest,
  resolveMaintenanceRequest,
  startMaintenanceWork,
} from '../../api/maintenance';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import KanbanColumn from '../../components/ui/KanbanColumn';
import Modal from '../../components/ui/Modal';
import './MaintenancePage.css';

const COLUMNS = [
  { key: 'pending', title: 'Pending', color: '#f59e0b' },
  { key: 'rejected', title: 'Rejected', color: '#ef4444' },
  { key: 'approved', title: 'Approved', color: '#22c55e' },
  { key: 'technician_assigned', title: 'Technician Assigned', color: '#60a5fa' },
  { key: 'in_progress', title: 'In Progress', color: '#fb923c' },
  { key: 'resolved', title: 'Resolved', color: '#34d399' },
];

const rsStyles = {
  control: (base, state) => ({
    ...base,
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${state.isFocused ? '#818cf8' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: 8,
    boxShadow: 'none',
    minHeight: 40,
  }),
  menu: (base) => ({ ...base, background: '#1e1f30', border: '1px solid rgba(255,255,255,0.1)', zIndex: 20 }),
  option: (base, state) => ({
    ...base,
    background: state.isSelected ? '#4f46e5' : state.isFocused ? 'rgba(129,140,248,0.15)' : 'transparent',
    color: '#f1f5f9',
  }),
  singleValue: (base) => ({ ...base, color: '#f1f5f9' }),
  input: (base) => ({ ...base, color: '#f1f5f9' }),
  placeholder: (base) => ({ ...base, color: '#64748b' }),
  indicatorSeparator: () => ({ display: 'none' }),
};

const rsTheme = (theme) => ({
  ...theme,
  colors: { ...theme.colors, primary: '#818cf8', primary25: 'rgba(129,140,248,0.15)' },
});

function Field({ label, children }) {
  return (
    <div className="af-maint-form">
      <label className="af-maint-label">{label}</label>
      {children}
    </div>
  );
}

function RequestModal({ isOpen, onClose, assets, onSuccess }) {
  const [asset, setAsset] = useState(null);
  const [priority, setPriority] = useState({ value: 'medium', label: 'Medium' });
  const [issue, setIssue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAsset(null);
      setPriority({ value: 'medium', label: 'Medium' });
      setIssue('');
    }
  }, [isOpen]);

  async function handleSubmit() {
    if (!asset) {
      toast.error('Select an asset');
      return;
    }
    if (!issue.trim()) {
      toast.error('Describe the issue');
      return;
    }

    setLoading(true);
    try {
      await createMaintenanceRequest({
        asset_id: asset.value,
        priority: priority.value,
        issue: issue.trim(),
      });
      toast.success('Maintenance request raised');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not raise request');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Raise Maintenance Request"
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={loading} onClick={handleSubmit}>Raise Request</Button>
        </div>
      )}
    >
      <div className="af-maint-form">
        <Field label="Asset">
          <Select
            options={assets.map((a) => ({ value: a.id, label: `${a.tag} - ${a.name} (${a.status})` }))}
            value={asset}
            onChange={setAsset}
            placeholder={assets.length ? 'Select asset...' : 'No assets available'}
            styles={rsStyles}
            theme={rsTheme}
          />
        </Field>
        <Field label="Priority">
          <Select
            options={['low', 'medium', 'high', 'critical'].map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
            value={priority}
            onChange={setPriority}
            styles={rsStyles}
            theme={rsTheme}
          />
        </Field>
        <Field label="Issue">
          <textarea
            className="af-input af-textarea"
            rows={4}
            value={issue}
            onChange={(event) => setIssue(event.target.value)}
            placeholder="What is broken or needs service?"
          />
        </Field>
      </div>
    </Modal>
  );
}

function AssignModal({ request, users, onClose, onSuccess }) {
  const [technician, setTechnician] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (request) setTechnician(null);
  }, [request]);

  async function handleAssign() {
    if (!technician) {
      toast.error('Select a technician');
      return;
    }

    setLoading(true);
    try {
      await assignMaintenanceTechnician(request.id, technician.label.split(' (')[0]);
      toast.success('Technician assigned');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Assignment failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={!!request}
      onClose={onClose}
      title="Assign Technician"
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={loading} onClick={handleAssign}>Assign</Button>
        </div>
      )}
    >
      <div className="af-maint-form">
        <p className="af-maint-muted">{request?.asset_tag} - {request?.asset_name}</p>
        <Field label="Technician">
          <Select
            options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
            value={technician}
            onChange={setTechnician}
            placeholder={users.length ? 'Select technician...' : 'No users loaded'}
            styles={rsStyles}
            theme={rsTheme}
          />
        </Field>
      </div>
    </Modal>
  );
}

function MaintenanceCard({ item, canRoute, canProgress, onApprove, onReject, onAssign, onStart, onResolve }) {
  const assignedToMe = canProgress(item);

  return (
    <Card variant="compact" hover>
      <div className="af-maint-card">
        <div className="af-maint-card__top">
          <div>
            <div className="af-maint-card__tag">{item.asset_tag}</div>
            <div className="af-maint-card__asset">{item.asset_name}</div>
          </div>
          <Badge status={item.priority} size="sm">{item.priority}</Badge>
        </div>
        <p className="af-maint-card__issue">{item.issue}</p>
        <div className="af-maint-card__meta">
          <span className="af-maint-muted">Raised by {item.raised_by_name}</span>
          {item.technician && <span className="af-maint-muted">Tech: {item.technician}</span>}
        </div>
        <div className="af-maint-card__actions">
          {canRoute && item.status === 'pending' && (
            <>
              <Button size="sm" onClick={() => onApprove(item.id)}>Approve</Button>
              <Button size="sm" variant="danger" onClick={() => onReject(item.id)}>Reject</Button>
            </>
          )}
          {canRoute && item.status === 'approved' && (
            <Button size="sm" variant="outline" onClick={() => onAssign(item)}>Assign</Button>
          )}
          {assignedToMe && item.status === 'technician_assigned' && (
            <Button size="sm" onClick={() => onStart(item.id)}>Start</Button>
          )}
          {assignedToMe && item.status === 'in_progress' && (
            <Button size="sm" onClick={() => onResolve(item.id)}>Resolve</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function MaintenancePage() {
  const { user } = useAuth();
  const canRoute = ['admin', 'asset_manager'].includes(user?.role);
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listMaintenanceRequests();
      setRequests(response.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load maintenance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
    getAssets({ per_page: 500 })
      .then((response) => setAssets((response.data.items || []).filter((asset) => !['Lost', 'Retired', 'Disposed'].includes(asset.status))))
      .catch(() => toast.error('Failed to load assets'));
    getUsers()
      .then((response) => setUsers(response.data))
      .catch(() => setUsers([]));
  }, [loadRequests]);

  const grouped = useMemo(() => (
    COLUMNS.reduce((acc, column) => {
      acc[column.key] = requests.filter((request) => request.status === column.key);
      return acc;
    }, {})
  ), [requests]);

  function canProgress(item) {
    if (canRoute) return true;
    return item.technician?.trim().toLowerCase() === user?.name?.trim().toLowerCase();
  }

  async function runAction(action, successMessage) {
    try {
      await action();
      toast.success(successMessage);
      loadRequests();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Action failed');
    }
  }

  return (
    <div className="af-maint-page">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1e1f30', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 },
      }} />

      <div className="af-maint-page__header">
        <div>
          <h1 className="af-maint-page__title">Maintenance Management</h1>
          <p className="af-maint-page__subtitle">
            {loading ? 'Loading requests...' : `${requests.length} request${requests.length === 1 ? '' : 's'} across the workflow`}
          </p>
        </div>
        <Button onClick={() => setRequestOpen(true)}>Raise Request</Button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="af-spinner" />
        </div>
      ) : (
        <div className="af-maint-board">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.key}
              title={column.title}
              color={column.color}
              items={grouped[column.key]}
              renderCard={(item) => (
                <MaintenanceCard
                  item={item}
                  canRoute={canRoute}
                  canProgress={canProgress}
                  onApprove={(id) => runAction(() => approveMaintenanceRequest(id), 'Request approved')}
                  onReject={(id) => runAction(() => rejectMaintenanceRequest(id), 'Request rejected')}
                  onAssign={setAssignTarget}
                  onStart={(id) => runAction(() => startMaintenanceWork(id), 'Work started')}
                  onResolve={(id) => runAction(() => resolveMaintenanceRequest(id), 'Request resolved')}
                />
              )}
            />
          ))}
        </div>
      )}

      <RequestModal
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
        assets={assets}
        onSuccess={loadRequests}
      />
      <AssignModal
        request={assignTarget}
        users={users}
        onClose={() => setAssignTarget(null)}
        onSuccess={loadRequests}
      />
    </div>
  );
}
