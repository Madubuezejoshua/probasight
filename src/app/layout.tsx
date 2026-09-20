import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SolanaWalletProvider } from "@/components/wallet/WalletProvider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "ProbaSight: Prediction markets, understood",
    template: "%s · ProbaSight",
  },
  description:
    "An AI-powered prediction-market intelligence and trading terminal built on Panta. Discover markets, read structured AI analysis, and trade YES/NO on Solana with your own wallet.",
  applicationName: "ProbaSight",
  keywords: [
    "prediction markets",
    "Panta",
    "Solana",
    "market intelligence",
    "forecasting",
  ],
  openGraph: {
    title: "ProbaSight: Prediction markets, understood",
    description:
      "Real-time Panta market intelligence, AI analysis, and on-chain trading in one terminal.",
    siteName: "ProbaSight",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#080B10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-[var(--color-accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#04201d]"
        >
          Skip to content
        </a>
        <SolanaWalletProvider>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
