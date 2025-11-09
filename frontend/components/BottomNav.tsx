"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from '@/lib/i18n/provider';
import { Home, Coins, Images } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const t = useTranslations('navbar');
  const pathname = usePathname();
  const isMyNFTsPage = pathname === '/my-nfts' || pathname?.startsWith('/my-nfts');

  const navItems = [
    { href: "/", label: t('home'), icon: Home },
    { href: "/marketplace", label: t('marketplace'), icon: Coins },
    { href: "/my-nfts", label: t('myNfts'), icon: Images },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center pb-6 px-6">
      {/* Floating Navigation Container - Rounded Style */}
      <div className={cn(
        "flex items-center backdrop-blur-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden min-w-[280px]",
        isMyNFTsPage ? "bg-[#242424]/90" : "bg-[#3A3A3A]/80"
      )} style={{ height: '64.524px', borderRadius: '25919828px' }}>
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname?.startsWith(item.href));
          
          const isFirst = index === 0;
          const isLast = index === navItems.length - 1;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-center transition-all duration-200 relative",
                "flex-1 min-w-[80px]",
                isFirst && "rounded-l-[25919828px]",
                isLast && "rounded-r-[25919828px]"
              )}
              style={{ height: '64.524px' }}
            >
              {/* Semi-transparent Background for Active State */}
              {isActive && (
                <div className={cn(
                  "absolute inset-0 rounded-full flex items-center justify-center",
                  isMyNFTsPage ? "bg-[#CEF248]" : "bg-[#CEF248]/80"
                )} style={{ width: '41.48px', height: '41.48px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
              )}
              
              <Icon
                className={cn(
                  "relative z-10 transition-colors"
                )}
                style={{ 
                  width: '20.75px', 
                  height: '20.75px',
                  color: isActive ? '#000000' : '#939393'
                }}
                strokeWidth={2}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


