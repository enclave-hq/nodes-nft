"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from '@/lib/i18n/provider';
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

// Home Icon SVG Component
function HomeIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg 
      width="18" 
      height="18" 
      viewBox="0 0 18 18" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <path 
        d="M0 8V0H8V8H0ZM0 18V10H8V18H0ZM10 8V0H18V8H10ZM10 18V10H18V18H10ZM2 6H6V2H2V6ZM12 6H16V2H12V6ZM12 16H16V12H12V16ZM2 16H6V12H2V16Z" 
        fill="currentColor"
      />
    </svg>
  );
}

// Market Icon SVG Component
function MarketIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg 
      width="19" 
      height="20" 
      viewBox="0 0 19 20" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <path 
        d="M5 11.65V4H8V11.65L6.5 10.25L5 11.65ZM10 13.15V0H13V10.15L10 13.15ZM0 16.6V8H3V13.6L0 16.6ZM0 19.05L6.45 12.6L10 15.65L15.6 10.05H14V8.05H19V13.05H17V11.45L10.1 18.35L6.55 15.3L2.8 19.05H0Z" 
        fill="currentColor"
      />
    </svg>
  );
}

// My NFTs Icon SVG Component
function MyNFTsIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg 
      width="20" 
      height="22" 
      viewBox="0 0 20 22" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <path 
        d="M0 5V0H5V2H2V5H0ZM18 5V2H15V0H20V5H18ZM0 22V17H2V20H5V22H0ZM15 22V20H18V17H20V22H15ZM5 17H15V5H5V17ZM5 19C4.45 19 3.97917 18.8042 3.5875 18.4125C3.19583 18.0208 3 17.55 3 17V5C3 4.45 3.19583 3.97917 3.5875 3.5875C3.97917 3.19583 4.45 3 5 3H15C15.55 3 16.0208 3.19583 16.4125 3.5875C16.8042 3.97917 17 4.45 17 5V17C17 17.55 16.8042 18.0208 16.4125 18.4125C16.0208 18.8042 15.55 19 15 19H5ZM7 9H13V7H7V9ZM7 12H13V10H7V12ZM7 15H13V13H7V15Z" 
        fill="currentColor"
      />
    </svg>
  );
}

export function BottomNav() {
  const t = useTranslations('navbar');
  const pathname = usePathname();
  const navContainerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });

  const navItems = [
    { href: "/", label: t('home'), icon: HomeIcon },
    { href: "/marketplace", label: t('marketplace'), icon: MarketIcon },
    { href: "/my-nfts", label: t('myNfts'), icon: MyNFTsIcon },
  ];

  // 计算当前激活按钮的位置和宽度
  const updateSliderPosition = () => {
    const activeIndex = navItems.findIndex(
      (item) => pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
    );

    if (activeIndex !== -1 && buttonRefs.current[activeIndex] && navContainerRef.current) {
      const activeButton = buttonRefs.current[activeIndex];
      const container = navContainerRef.current;
      
      const buttonRect = activeButton.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      setSliderStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });
    }
  };

  useEffect(() => {
    // 延迟执行以确保 DOM 已渲染
    const timer = setTimeout(updateSliderPosition, 0);
    
    // 监听窗口大小改变
    window.addEventListener('resize', updateSliderPosition);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSliderPosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center pb-6 px-6">
      {/* Floating Navigation Container - Rounded Style */}
      <div
        ref={navContainerRef}
        className={cn(
          "flex items-center backdrop-blur-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden min-w-[280px] relative",
          "bg-[#3a3a3a]"
        )}
        style={{ height: '64.524px', borderRadius: '25919828px' }}
      >
        {/* Sliding Background */}
        <div
          className="absolute bg-[#CEF248] transition-all duration-300 ease-in-out"
          style={{
            left: `${sliderStyle.left}px`,
            width: `${sliderStyle.width}px`,
            height: '64.524px',
            borderRadius: '25919828px',
            zIndex: 0,
          }}
        />

        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname?.startsWith(item.href));
          
          const isFirst = index === 0;
          const isLast = index === navItems.length - 1;
          
          return (
            <Link
              key={item.href}
              ref={(el) => (buttonRefs.current[index] = el)}
              href={item.href}
              className={cn(
                "flex items-center justify-center transition-colors duration-200 relative",
                "flex-1 min-w-[80px]",
                isFirst && "rounded-l-[25919828px]",
                isLast && "rounded-r-[25919828px]"
              )}
              style={{ height: '64.524px', zIndex: 1 }}
            >
              <Icon
                className={cn(
                  "transition-colors duration-200"
                )}
                style={{ 
                  width: '20.75px', 
                  height: '20.75px',
                  color: isActive ? '#000000' : '#939393'
                }}
                {...(item.icon !== MarketIcon && item.icon !== HomeIcon && item.icon !== MyNFTsIcon && { strokeWidth: 2 })}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


