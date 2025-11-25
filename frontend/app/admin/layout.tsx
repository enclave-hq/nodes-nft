'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminLogin } from '@/components/AdminLogin';
import { isAuthenticated, logout } from '@/lib/api';
import toast from 'react-hot-toast';

// Admin navigation items
const navItems = [
  { path: '/admin', label: '概览', icon: '📊' },
  { path: '/admin/stats', label: '数据统计', icon: '📈' },
  { path: '/admin/users', label: '用户管理', icon: '👥' },
  { path: '/admin/batches', label: '批次管理', icon: '📦' },
  { path: '/admin/whitelist', label: '白名单管理', icon: '✅' },
  { path: '/admin/nfts', label: 'NFT管理', icon: '🔍' },
  { path: '/admin/invite-codes', label: '邀请码管理', icon: '🎫' },
  { path: '/admin/revenue', label: '收入管理', icon: '💰' },
  { path: '/admin/totp-settings', label: 'TOTP设置', icon: '🔐' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticatedState, setIsAuthenticatedState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setIsAuthenticatedState(isAuthenticated());
    setIsLoading(false);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticatedState(true);
  };

  const handleLogout = () => {
    logout();
    setIsAuthenticatedState(false);
    toast.success('已退出登录');
    router.push('/admin');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticatedState) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">管理后台</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <aside className="w-64 flex-shrink-0">
            <nav className="bg-white rounded-lg shadow-sm p-4">
              <ul className="space-y-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.path || 
                    (item.path === '/admin' && pathname === '/admin');
                  return (
                    <li key={item.path}>
                      <a
                        href={item.path}
                        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-lg">{item.icon}</span>
                        <span>{item.label}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

