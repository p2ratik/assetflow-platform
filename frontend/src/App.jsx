import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './features/auth/LoginPage';
import SignupPage from './features/auth/SignupPage';
import AllocationTransferPage from './features/allocation/AllocationTransferPage';

// Placeholder pages — each team member builds their feature pages
function PlaceholderPage({ title }) {
  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 'var(--space-4)' }}>{title}</h2>
      <p style={{ color: 'var(--text-secondary)' }}>
        This screen will be built during the sprint. The shared UI kit and layout shell are ready.
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

          {/* Protected routes — wrapped in AppLayout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Screen 2: Dashboard */}
            <Route index element={<PlaceholderPage title="Dashboard" />} />

            {/* Screen 3: Organization Setup — Admin only */}
            <Route
              path="organization"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <PlaceholderPage title="Organization Setup" />
                </ProtectedRoute>
              }
            />

            {/* Screen 4: Asset Directory */}
            <Route path="assets" element={<PlaceholderPage title="Asset Directory" />} />

            {/* Screen 5: Allocation & Transfer */}
            <Route
              path="allocation"
              element={
                <ProtectedRoute allowedRoles={['admin', 'asset_manager', 'dept_head']}>
                  <AllocationTransferPage />
                </ProtectedRoute>
              }
            />

            {/* Screen 6: Resource Booking */}
            <Route path="booking" element={<PlaceholderPage title="Resource Booking" />} />

            {/* Screen 7: Maintenance */}
            <Route path="maintenance" element={<PlaceholderPage title="Maintenance" />} />

            {/* Screen 8: Audit */}
            <Route
              path="audit"
              element={
                <ProtectedRoute allowedRoles={['admin', 'asset_manager']}>
                  <PlaceholderPage title="Audit" />
                </ProtectedRoute>
              }
            />

            {/* Screen 9: Reports */}
            <Route
              path="reports"
              element={
                <ProtectedRoute allowedRoles={['admin', 'asset_manager', 'dept_head']}>
                  <PlaceholderPage title="Reports & Analytics" />
                </ProtectedRoute>
              }
            />

            {/* Screen 10: Notifications */}
            <Route path="notifications" element={<PlaceholderPage title="Notifications & Activity Log" />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
