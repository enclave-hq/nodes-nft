import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Chakra_Petch } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers/Providers";
import { I18nProvider } from "@/lib/i18n/provider";
import { DebugPanel } from "@/components/DebugPanel";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const chakraPetch = Chakra_Petch({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-chakra-petch",
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
      <body className={`${inter.variable} ${chakraPetch.variable} antialiased`} style={{ fontFamily: 'var(--font-chakra-petch)' }}>
        <I18nProvider>
          <Providers>
            {children}
            {/* <DebugPanel /> */}
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
