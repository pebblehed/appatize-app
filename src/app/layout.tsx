// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { TrendProvider } from "@/context/TrendContext";
import { BriefProvider } from "@/context/BriefContext";

export const metadata: Metadata = {
  title: "CultureOS MVP",
  description: "Trend, UGC and OS for modern brands and creators.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-shell-bg text-neutral-50 antialiased">
        <TrendProvider>
          <BriefProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1">
                <header className="flex items-center justify-between border-b border-shell-border px-8 py-4">
                  <div className="text-xs font-medium tracking-[0.24em] text-neutral-400">
                    CULTUREOS MVP
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Where brands meet the moment
                  </div>
                </header>

                <div className="relative">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-pink/6 via-transparent to-brand-amber/6" />
                  <div className="relative mx-auto max-w-6xl px-6 py-8">
                    {children}
                  </div>
                </div>
              </main>
            </div>
          </BriefProvider>
        </TrendProvider>
      </body>
    </html>
  );
}
