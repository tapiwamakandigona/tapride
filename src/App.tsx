// [INTENT] Root application router — maps URL paths to page components
// [CONSTRAINT] Uses React.lazy + Suspense for route-level code splitting to reduce initial bundle size
// [CONSTRAINT] ProtectedRoute redirects unauthenticated users to /login; GuestRoute redirects logged-in users to their dashboard
// [EDGE-CASE] GuestRoute must wait for BOTH auth AND profile to load before redirecting —
//   an orphaned auth row with no profile row should still show guest content

import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './components/Layout/AppLayout';

// [INTENT] Lazy-load every page so the initial JS bundle only contains the shell + router
const Splash = lazy(() => import('./pages/Splash'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const RiderDashboard = lazy(() => import('./pages/RiderDashboard'));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard'));
const ActiveRide = lazy(() => import('./pages/ActiveRide'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const RateRide = lazy(() => import('./pages/RateRide'));
const RideHistory = lazy(() => import('./pages/RideHistory'));
const Profile = lazy(() => import('./pages/Profile'));
// [INTENT] Email verification callback page — Supabase redirects here after user clicks email link
// [CONSTRAINT] Supabase dashboard "Redirect URLs" must include: https://tapiwamakandigona.github.io/tapride/verify
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// [INTENT] Shared loading fallback for Suspense boundaries
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user && profile) {
    const path = profile.user_type === 'driver' ? '/driver' : '/rider';
    return <Navigate to={path} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Splash />} />
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <Login />
                </GuestRoute>
              }
            />
            <Route
              path="/register"
              element={
                <GuestRoute>
                  <Register />
                </GuestRoute>
              }
            />
            {/* [INTENT] Email verification callback — public route, not guest-gated, because
                Supabase may set the session before this page renders (making GuestRoute redirect away) */}
            <Route path="/verify" element={<VerifyEmail />} />
            {/* [INTENT] Password reset flow — forgot is guest-gated, reset is public (Supabase sets session via hash) */}
            <Route
              path="/forgot-password"
              element={
                <GuestRoute>
                  <ForgotPassword />
                </GuestRoute>
              }
            />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes with bottom navbar */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/rider" element={<RiderDashboard />} />
              <Route path="/driver" element={<DriverDashboard />} />
              <Route path="/history" element={<RideHistory />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Protected routes without bottom navbar */}
            <Route
              path="/ride/active"
              element={
                <ProtectedRoute>
                  <ActiveRide />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ride/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ride/rate"
              element={
                <ProtectedRoute>
                  <RateRide />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}
