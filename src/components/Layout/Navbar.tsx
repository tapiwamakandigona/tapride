import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import ConfirmModal from '../ui/ConfirmModal';

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  // Dynamic home path based on user role
  const homePath = profile?.user_type === 'driver' ? '/driver' : '/rider';

  const navItems = [
    { path: homePath, label: 'Home', icon: 'home' },
    { path: '/history', label: 'History', icon: 'history' },
    { path: '/profile', label: 'Profile', icon: 'profile' },
  ];

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await signOut();
  };

  const renderIcon = (icon: string, active: boolean) => {
    const cls = `w-5 h-5 ${active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`;
    switch (icon) {
      case 'home':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        );
      case 'history':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      case 'profile':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.label}
              className={`flex flex-col items-center py-2 px-3 text-xs transition-colors ${
                isActive(item.path)
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <span className="mb-0.5">{renderIcon(item.icon, isActive(item.path))}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          <div className="flex flex-col items-center py-2 px-3">
            <ThemeToggle />
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            aria-label="Logout"
            className="flex flex-col items-center py-2 px-3 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </nav>

      {showLogoutConfirm && (
        <ConfirmModal
          title="Sign Out?"
          message="Are you sure you want to sign out of TapRide?"
          confirmLabel="Sign Out"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
          destructive
        />
      )}
    </>
  );
}
