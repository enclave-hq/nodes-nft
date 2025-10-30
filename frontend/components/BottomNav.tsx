"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from '@/lib/i18n/provider';
import { Home, Coins, Images } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const t = useTranslations('navbar');
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: t('home'), icon: Home },
    { href: "/marketplace", label: t('marketplace'), icon: Coins },
    { href: "/my-nfts", label: t('myNfts'), icon: Images },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center pb-6 px-6">
      {/* Floating Navigation Container - Rounded Style */}
      <div className="flex items-center bg-gray-100/80 backdrop-blur-lg rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden min-w-[280px]">
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
                "flex-1 h-16 min-w-[80px]",
                isFirst && "rounded-l-[28px]",
                isLast && "rounded-r-[28px]"
              )}
            >
              {/* Semi-transparent Background for Active State */}
              {isActive && (
                <div className="absolute inset-0 bg-white/80 rounded-full" />
              )}
              
              <Icon
                className={cn(
                  "relative z-10 transition-colors",
                  isActive ? "h-7 w-7 text-blue-600" : "h-6 w-6 text-gray-500"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


