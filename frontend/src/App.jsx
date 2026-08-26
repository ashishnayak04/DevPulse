import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { Spinner } from './components/ui/Spinner';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import { ErrorBoundary } from './components/ErrorBoundary';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const EndpointDetail = lazy(() => import('./pages/EndpointDetail'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const Activity = lazy(() => import('./pages/Activity'));
const Settings = lazy(() => import('./pages/Settings'));
const Admin = lazy(() => import('./pages/Admin'));
const Incidents = lazy(() => import('./pages/Incidents'));
const Teams = lazy(() => import('./pages/Teams'));
const TeamStatusPage = lazy(() => import('./pages/TeamStatusPage'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));

const PageLoader = () => (
  <div className="full-center" style={{ background: 'var(--bg-base)' }}>
    <Spinner size="lg" />
  </div>
);

const RootLanding = () => {
  React.useEffect(() => {
    window.location.replace('/landing');
  }, []);
  return <PageLoader />;
};

import { useAuth } from './context/AuthContext';

const UserRoute = () => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Outlet />;
};

const RootRedirect = () => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
};

const App = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <AnnouncementBanner />
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
              <Route path="/" element={<RootLanding />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/status/team/:slug" element={<TeamStatusPage />} />
              <Route path="/status/:username" element={<StatusPage />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />

              <Route element={<UserRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/endpoints/:id" element={<EndpointDetail />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/teams" element={<Teams />} />
                <Route path="/teams/:slug" element={<Teams />} />
              </Route>

              <Route element={<ProtectedRoute />}>
                <Route path="/settings" element={<Settings />} />
              </Route>

              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<Admin />} />
              </Route>

              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
