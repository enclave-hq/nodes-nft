"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from '@/lib/i18n/provider';
import { Home, Coins, Images } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const t = useTranslations('navbar');
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: t('home'), icon: Home },
    { href: "/marketplace", label: t('marketplace'), icon: Coins },
    { href: "/my-nfts", label: t('myNfts'), icon: Images },
  ];

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:bg-white lg:border-r lg:border-gray-200">
      <div className="flex flex-col grow pt-5 pb-4 overflow-y-auto">
              {/* Logo */}
              <div className="flex items-center shrink-0 px-4 mb-8">
                <Link href="/" className="flex items-center space-x-2">
                  <Image
                    src="/logo_icon.png"
                    alt="Enclave Logo"
                    width={32}
                    height={32}
                    className="h-8 w-8"
                  />
                  <span className="text-xl font-bold text-gray-900">Enclave</span>
                </Link>
              </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || 
              (item.href !== "/" && pathname?.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon
                  className={cn(
                    "mr-3 h-5 w-5 shrink-0",
                    isActive ? "text-blue-700" : "text-gray-400 group-hover:text-gray-500"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

