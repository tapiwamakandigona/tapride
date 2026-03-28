import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/dashboard', label: 'Home', icon: '⌂' },
    { path: '/history', label: 'History', icon: '☰' },
    { path: '/profile', label: 'Profile', icon: '◉' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50 safe-area-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center py-2 px-3 text-xs transition-colors ${
              isActive(item.path)
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <span className="text-lg mb-0.5">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
        <div className="flex flex-col items-center py-2 px-3">
          <ThemeToggle />
        </div>
        <button
          onClick={signOut}
          className="flex flex-col items-center py-2 px-3 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors"
        >
          <span className="text-lg mb-0.5">⏻</span>
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}
