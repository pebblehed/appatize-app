"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Radar", href: "/" },
  { label: "Trends", href: "/trends" },
  { label: "Briefs", href: "/briefs" },
  { label: "Scripts", href: "/scripts" },
  { label: "Saved", href: "/saved" },
  { label: "Calendar", href: "/calendar" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r border-shell-border bg-black/40 px-4 py-4">
      {/* Logo */}
      <div className="flex items-center gap-2 px-1">
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-pink via-brand-amber to-brand-pink shadow-brand-glow" />
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-wide">
            CultureOS
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">
            Trend • UGC • OS
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-6 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "group flex items-center gap-2 rounded-pill px-3 py-2 text-xs font-medium transition-all duration-200 border",
                isActive
                  ? "border-brand-pink/60 bg-black/40 text-brand-pink shadow-brand-glow"
                  : "border-transparent text-neutral-300 hover:bg-black/30 hover:text-brand-pink hover:border-brand-pink/40",
              ].join(" ")}
            >
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full transition-all",
                  isActive
                    ? "bg-brand-pink"
                    : "bg-neutral-500 group-hover:bg-brand-pink",
                ].join(" ")}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
