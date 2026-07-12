import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const NAV_ITEMS = [
  {
    path: '/',
    label: 'Dashboard',
    icon: '📊',
    roles: ['admin', 'asset_manager', 'dept_head', 'employee'],
  },
  {
    path: '/organization',
    label: 'Organization',
    icon: '🏢',
    roles: ['admin'],
  },
  {
    path: '/assets',
    label: 'Asset Directory',
    icon: '📦',
    roles: ['admin', 'asset_manager', 'dept_head', 'employee'],
  },
  {
    path: '/allocation',
    label: 'Allocation',
    icon: '🔄',
    roles: ['admin', 'asset_manager', 'dept_head', 'employee'],
  },
  {
    path: '/booking',
    label: 'Booking',
    icon: '📅',
    roles: ['admin', 'asset_manager', 'dept_head', 'employee'],
  },
  {
    path: '/maintenance',
    label: 'Maintenance',
    icon: '🔧',
    roles: ['admin', 'asset_manager', 'dept_head', 'employee'],
  },
  {
    path: '/audit',
    label: 'Audit',
    icon: '🔍',
    roles: ['admin', 'asset_manager'],
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: '📈',
    roles: ['admin', 'asset_manager', 'dept_head'],
  },
  {
    path: '/notifications',
    label: 'Notifications',
    icon: '🔔',
    roles: ['admin', 'asset_manager', 'dept_head', 'employee'],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { role } = useAuth();
  const location = useLocation();

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(role)
  );

  return (
    <aside className={`af-sidebar ${collapsed ? 'af-sidebar--collapsed' : ''}`}>
      {/* Logo */}
      <div className="af-sidebar__logo" onClick={() => setCollapsed(!collapsed)}>
        <span className="af-sidebar__logo-icon">⚡</span>
        {!collapsed && <span className="af-sidebar__logo-text">AssetFlow</span>}
      </div>

      {/* Nav */}
      <nav className="af-sidebar__nav">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `af-sidebar__link ${isActive ? 'af-sidebar__link--active' : ''}`
            }
            end={item.path === '/'}
            title={collapsed ? item.label : undefined}
          >
            <span className="af-sidebar__link-icon">{item.icon}</span>
            {!collapsed && <span className="af-sidebar__link-label">{item.label}</span>}
            {!collapsed && location.pathname === item.path && (
              <span className="af-sidebar__active-bar" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        className="af-sidebar__toggle"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '→' : '←'}
      </button>
    </aside>
  );
}
