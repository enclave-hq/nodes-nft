import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers/Providers";
import { I18nProvider } from "@/lib/i18n/provider";
import { DebugPanel } from "@/components/DebugPanel";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Enclave Node NFT",
  description: "Decentralized Node NFT Platform with Reward Distribution",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <I18nProvider>
          <Providers>
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
            {/* <DebugPanel /> */}
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
