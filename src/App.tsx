import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/Layout/AppLayout';
import Splash from './pages/Splash';
import Login from './pages/Login';
import Register from './pages/Register';
import RiderDashboard from './pages/RiderDashboard';
import DriverDashboard from './pages/DriverDashboard';
import ActiveRide from './pages/ActiveRide';
import ChatPage from './pages/ChatPage';
import RateRide from './pages/RateRide';
import RideHistory from './pages/RideHistory';
import Profile from './pages/Profile';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  // Wait for both auth AND profile to finish loading before redirecting
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user && profile) {
    const path = profile.user_type === 'driver' ? '/driver' : '/rider';
    return <Navigate to={path} replace />;
  }

  // If user exists but profile hasn't loaded yet, still show guest content
  // (this handles edge case of orphaned auth with no profile row)
  return <>{children}</>;
}

export default function App() {
  return (
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
  );
}
