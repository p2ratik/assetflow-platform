import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './AppLayout.css';

export default function AppLayout() {
  return (
    <div className="af-layout">
      <Sidebar />
      <Topbar />
      <main className="af-layout__main">
        <Outlet />
      </main>
    </div>
  );
}
