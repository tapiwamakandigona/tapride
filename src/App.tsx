import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { useLoadingTimeout } from './hooks/useLoadingTimeout';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkBanner from './components/Layout/NetworkBanner';
import UpdateBanner from './components/Layout/UpdateBanner';
import RetryError from './components/Layout/RetryError';
import Toast from './components/Layout/Toast';
import AppLayout from './components/Layout/AppLayout';

// Eager: critical entry pages
import Splash from './pages/Splash';
import Login from './pages/Login';

// Lazy: everything else
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const EstimateFare = lazy(() => import('./pages/EstimateFare'));
const RiderDashboard = lazy(() => import('./pages/RiderDashboard'));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard'));
const ActiveRide = lazy(() => import('./pages/ActiveRide'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const RateRide = lazy(() => import('./pages/RateRide'));
const RideHistory = lazy(() => import('./pages/RideHistory'));
const Profile = lazy(() => import('./pages/Profile'));
const RideReceipt = lazy(() => import('./pages/RideReceipt'));
const DriverVerification = lazy(() => import('./pages/DriverVerification'));
const ScheduledRides = lazy(() => import('./pages/ScheduledRides'));
const DriverEarnings = lazy(() => import('./pages/DriverEarnings'));
const ManageFavorites = lazy(() => import('./pages/ManageFavorites'));

function LazyFallback() {
  const { timedOut } = useLoadingTimeout(true);
  if (timedOut) {
    return <RetryError message="Page took too long to load" onRetry={() => window.location.reload()} />;
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading page" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, authError, retryAuth } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" role="status" aria-label="Authenticating" />
      </div>
    );
  }

  if (authError && !user) {
    return <RetryError message="Couldn't connect" onRetry={retryAuth} />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (user && profile) {
    const path = profile.user_type === 'driver' ? '/driver' : '/rider';
    return <Navigate to={path} replace />;
  }

  return <>{children}</>;
}

/**
 * Router choice: BrowserRouter + 404.html redirect (not HashRouter).
 *
 * Why not HashRouter?
 * - HashRouter puts routes after # (e.g. /tapride/#/rider) which breaks:
 *   • Supabase OAuth callbacks (redirect URL won't match)
 *   • Open Graph / social sharing (crawlers ignore hash fragments)
 *   • Analytics tracking of page views
 * - BrowserRouter + the 404.html→index.html redirect trick works reliably
 *   on GitHub Pages. The 404.html encodes the path into query params,
 *   and a script in index.html decodes it via history.replaceState before
 *   React mounts. This gives clean URLs that work on refresh.
 *
 * The only downside is a brief 404 status code on direct navigation,
 * which doesn't matter for a client-side app (no SSR/SEO needed).
 */
export default function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
          <Toast />
          <NetworkBanner />
          <UpdateBanner />
          <Suspense fallback={<LazyFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Splash />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/estimate" element={<EstimateFare />} />
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
              <Route
                path="/forgot-password"
                element={
                  <GuestRoute>
                    <ForgotPassword />
                  </GuestRoute>
                }
              />

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
                <Route path="/scheduled" element={<ScheduledRides />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/driver/earnings" element={<DriverEarnings />} />
                <Route path="/favorites" element={<ManageFavorites />} />
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
              <Route
                path="/ride/receipt"
                element={
                  <ProtectedRoute>
                    <RideReceipt />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/driver/verify"
                element={
                  <ProtectedRoute>
                    <DriverVerification />
                  </ProtectedRoute>
                }
              />
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </ErrorBoundary>
    </ToastProvider>
  );
}
