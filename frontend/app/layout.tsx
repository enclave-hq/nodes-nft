import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers/Providers";
import { I18nProvider } from "@/lib/i18n/provider";
import { DebugPanel } from "@/components/DebugPanel";
import { ConditionalLayout } from "@/components/ConditionalLayout";
import { ProtectImages } from "./protect-images";
import { GlobalWhitelistModal } from "@/components/GlobalWhitelistModal";

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
            <ProtectImages />
            <ConditionalLayout>
              {children}
            </ConditionalLayout>
            <GlobalWhitelistModal />
            {/* <DebugPanel /> */}
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
