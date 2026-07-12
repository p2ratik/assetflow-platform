import { useAuth } from '../../context/AuthContext';
import './Topbar.css';

export default function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="af-topbar">
      <div className="af-topbar__left">
        <div className="af-topbar__search">
          <svg className="af-topbar__search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search assets, bookings, people…"
            className="af-topbar__search-input"
          />
          <kbd className="af-topbar__search-shortcut">⌘K</kbd>
        </div>
      </div>

      <div className="af-topbar__right">
        {/* Notification bell */}
        <button className="af-topbar__icon-btn" title="Notifications">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="af-topbar__notif-dot" />
        </button>

        {/* User dropdown */}
        <div className="af-topbar__user">
          <div className="af-topbar__avatar">
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="af-topbar__user-info">
            <span className="af-topbar__user-name">{user?.name || 'User'}</span>
            <span className="af-topbar__user-role">{user?.role?.replace('_', ' ') || 'employee'}</span>
          </div>
          <button className="af-topbar__logout" onClick={logout} title="Sign out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
