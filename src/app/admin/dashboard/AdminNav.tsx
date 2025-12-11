import { useRouter, usePathname } from 'next/navigation';
import React, { useState, useEffect } from 'react';

interface AdminNavProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

const tabs = [
  { id: 'overview', name: 'Overview' },
  { id: 'analytics', name: 'Analytics' },
  { id: 'knowledge', name: 'Knowledge Base' },
  { id: 'agents', name: 'Agents' },
  { id: 'system', name: 'System' },
  { id: 'unanswered', name: 'Unanswered', route: '/admin/unanswered' },
  { id: 'sessions', name: 'Sessions', route: '/admin/sessions' },
  { id: 'thumbs', name: 'Thumbs Down', route: '/admin/feedback' },
  { id: 'users', name: 'Users', route: '/admin/users' },
];

export default function AdminNav({ activeTab, onTabChange }: AdminNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Fetch current user info
    fetch('/api/admin/auth')
      .then(res => {
        if (!res.ok) {
          throw new Error('Auth check failed');
        }
        return res.json();
      })
      .then(data => {
        if (data && data.authenticated && data.admin) {
          setCurrentUser(data.admin);
        }
      })
      .catch(err => {
        console.error('Failed to fetch user:', err);
        // Don't set user if fetch fails
      });
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Determine active tab
  const getIsActive = (tab: typeof tabs[0]) => {
    if (tab.id === 'unanswered') return pathname === '/admin/unanswered';
    if (tab.id === 'sessions') return pathname === '/admin/sessions';
    if (tab.id === 'thumbs') return pathname === '/admin/feedback';
    if (tab.id === 'users') return pathname === '/admin/users';
    return activeTab === tab.id && pathname === '/admin/dashboard';
  };

  const handleTabClick = (tab: typeof tabs[0]) => {
    if (tab.route) {
      // Navigate to separate pages (unanswered, sessions)
      router.push(tab.route);
    } else {
      // Navigate to dashboard and set active tab
      if (pathname !== '/admin/dashboard') {
        router.push(`/admin/dashboard?tab=${tab.id}`);
      } else if (onTabChange) {
        onTabChange(tab.id);
      }
    }
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Oman Airports Admin</h1>
              <span className="ml-3 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                Dashboard
              </span>
            </div>
            <div className="flex items-center space-x-4">
              {currentUser && currentUser.email && (
                <span className="text-sm text-gray-600">
                  {currentUser.email} ({currentUser.role || 'admin'})
                </span>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const isActive = getIsActive(tab);
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
} 