'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { BottomNav } from '@/components/BottomNav';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  if (isAdminRoute) {
    // Admin 路由：不显示 Sidebar 和 BottomNav
    return <main>{children}</main>;
  }

  // 普通路由：显示 Sidebar 和 BottomNav
  return (
    <div className="lg:pl-64">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <main className="pb-16 lg:pb-0">
        {children}
      </main>
      
      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}

