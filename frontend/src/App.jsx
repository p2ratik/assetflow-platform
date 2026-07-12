import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

// Real feature pages
import LoginPage from './features/auth/LoginPage';
import SignupPage from './features/auth/SignupPage';
import SetupPage from './features/auth/SetupPage';
import DashboardPage from './features/dashboard/DashboardPage';
import OrganizationPage from './features/organization/OrganizationPage';
import AssetsPage from './features/assets/AssetsPage';
import AllocationPage from './features/allocation/AllocationPage';
import BookingPage from './features/booking/BookingPage';
import MaintenancePage from './features/maintenance/MaintenancePage';

// Placeholder for B & C modules — they replace these
function ComingSoon({ title }) {
  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        {title}
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        This module is being built by another team member. The shared UI kit and API client are ready.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/setup" element={<SetupPage />} />

          {/* Protected routes — all wrapped in AppLayout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Screen 2: Dashboard — Member A */}
            <Route index element={<DashboardPage />} />

            {/* Screen 3: Organization Setup — Admin only */}
            <Route
              path="organization"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <OrganizationPage />
                </ProtectedRoute>
              }
            />

            {/* Screen 4: Asset Directory — Member A */}
            <Route path="assets" element={<AssetsPage />} />

            {/* Screen 5: Allocation & Transfer — Member B */}
            <Route
              path="allocation"
              element={
                <ProtectedRoute allowedRoles={['admin', 'asset_manager', 'dept_head', 'employee']}>
                  <AllocationPage />
                </ProtectedRoute>
              }
            />

            {/* Screen 6: Resource Booking — Member B */}
            <Route path="booking" element={<BookingPage />} />

            {/* Screen 7: Maintenance — Member C */}
            <Route path="maintenance" element={<MaintenancePage />} />

            {/* Screen 8: Audit — Member C */}
            <Route
              path="audit"
              element={
                <ProtectedRoute allowedRoles={['admin', 'asset_manager']}>
                  <ComingSoon title="Audit" />
                </ProtectedRoute>
              }
            />

            {/* Screen 9: Reports — Member C */}
            <Route
              path="reports"
              element={
                <ProtectedRoute allowedRoles={['admin', 'asset_manager', 'dept_head']}>
                  <ComingSoon title="Reports & Analytics" />
                </ProtectedRoute>
              }
            />

            {/* Screen 10: Notifications — Member C */}
            <Route path="notifications" element={<ComingSoon title="Notifications & Activity Log" />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
