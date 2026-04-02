import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function AppLayout() {
  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>
      <Navbar />
    </div>
  );
}
