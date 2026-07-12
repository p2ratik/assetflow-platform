import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getDashboardStats, getOverdueAllocations, getRecentActivity } from '../../api/dashboard';
import './DashboardPage.css';

// ── KPI Card ──────────────────────────────────────────────────
function StatCard({ label, value, icon, color, sub }) {
  return (
    <div className={`af-stat-card af-stat-card--${color}`}>
      <div className="af-stat-card__icon">{icon}</div>
      <div className="af-stat-card__body">
        <span className="af-stat-card__value">{value ?? '—'}</span>
        <span className="af-stat-card__label">{label}</span>
        {sub && <span className="af-stat-card__sub">{sub}</span>}
      </div>
    </div>
  );
}

// ── Action Label ──────────────────────────────────────────────
function actionLabel(action) {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Time Ago ──────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [overdue, setOverdue] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, o, a] = await Promise.all([
        getDashboardStats(),
        getOverdueAllocations(5),
        getRecentActivity(15),
      ]);
      setStats(s.data);
      setOverdue(o.data);
      setActivity(a.data);
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="af-dashboard af-dashboard--loading">
        <div className="af-spinner" />
        <p>Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="af-dashboard">
      {/* Header */}
      <div className="af-dashboard__header">
        <div>
          <h1 className="af-dashboard__title">
            Good {getGreeting()},{' '}
            <span className="af-dashboard__name">{user?.name?.split(' ')[0]}</span> 👋
          </h1>
          <p className="af-dashboard__subtitle">
            Here's what's happening across your assets today.
          </p>
        </div>
        <button className="af-btn af-btn--outline af-btn--sm" onClick={load}>
          ↻ Refresh
        </button>
      </div>

      {error && <div className="af-dashboard__error">⚠ {error}</div>}

      {/* KPI Grid */}
      {stats && (
        <div className="af-dashboard__kpi-grid">
          <StatCard
            label="Total Assets"
            value={stats.assets.total}
            icon="📦"
            color="blue"
          />
          <StatCard
            label="Available"
            value={stats.assets.available}
            icon="✅"
            color="green"
          />
          <StatCard
            label="Allocated"
            value={stats.assets.allocated}
            icon="🔄"
            color="purple"
          />
          <StatCard
            label="Under Maintenance"
            value={stats.assets.under_maintenance}
            icon="🔧"
            color="amber"
          />
          <StatCard
            label="Overdue Returns"
            value={stats.overdue_count}
            icon="⚠️"
            color={stats.overdue_count > 0 ? 'red' : 'green'}
            sub={stats.overdue_count > 0 ? 'Needs attention' : 'All clear'}
          />
          <StatCard
            label="Pending Maintenance"
            value={stats.pending_maintenance}
            icon="🛠"
            color="amber"
          />
          <StatCard
            label="Open Audits"
            value={stats.open_audits}
            icon="🔍"
            color="blue"
          />
          <StatCard
            label="Active Users"
            value={stats.total_users}
            icon="👥"
            color="purple"
          />
        </div>
      )}

      <div className="af-dashboard__bottom">
        {/* Overdue Banner */}
        {overdue.length > 0 && (
          <section className="af-dashboard__section">
            <div className="af-dashboard__section-header">
              <h2 className="af-dashboard__section-title">
                <span className="af-dashboard__alert-dot" />
                Overdue Returns
              </h2>
              <span className="af-overdue-count">{overdue.length} items</span>
            </div>
            <div className="af-overdue-list">
              {overdue.map((item) => (
                <div key={item.allocation_id} className="af-overdue-item">
                  <div className="af-overdue-item__asset">
                    <span className="af-overdue-item__tag">{item.asset_tag}</span>
                    <span className="af-overdue-item__name">{item.asset_name}</span>
                  </div>
                  <div className="af-overdue-item__holder">
                    <span className="af-overdue-item__icon">👤</span>
                    {item.employee_name}
                  </div>
                  <div className="af-overdue-item__days">
                    <span className="af-overdue-badge">{item.days_overdue}d overdue</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Activity Feed */}
        <section className="af-dashboard__section">
          <div className="af-dashboard__section-header">
            <h2 className="af-dashboard__section-title">Recent Activity</h2>
          </div>
          {activity.length === 0 ? (
            <p className="af-dashboard__empty">No activity yet. Actions will appear here.</p>
          ) : (
            <div className="af-activity-feed">
              {activity.map((log) => (
                <div key={log.id} className="af-activity-item">
                  <div className="af-activity-item__avatar">
                    {log.user_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="af-activity-item__body">
                    <span className="af-activity-item__user">{log.user_name}</span>
                    <span className="af-activity-item__action">
                      {actionLabel(log.action)}
                    </span>
                    {log.entity_type && (
                      <span className="af-activity-item__entity">
                        #{log.entity_id} ({log.entity_type})
                      </span>
                    )}
                  </div>
                  <span className="af-activity-item__time">{timeAgo(log.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
