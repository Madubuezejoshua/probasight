"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { ProbaSightMark, ProbaSightWordmark } from "./Logo";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/markets", label: "Markets" },
  { href: "/create", label: "Create Market" },
  { href: "/portfolio", label: "Portfolio" },
];

/**
 * Application chrome: 56-64px tall, thin bottom border, logo left, navigation
 * left-of-centre, wallet right. Mobile collapses navigation into a sheet.
 */
export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Route changes close any open overlay so navigation never leaves one stuck.
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [menuOpen]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/markets?q=${encodeURIComponent(trimmed)}` : "/markets");
    setSearchOpen(false);
  }

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg)]/92 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:h-16 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          aria-label="ProbaSight home"
        >
          <ProbaSightMark className="h-7 w-7" />
          <ProbaSightWordmark className="hidden text-[15px] sm:inline" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-[var(--radius-chip)] px-3 py-1.5 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-[var(--color-surface-2)] text-[var(--color-text)]"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {searchOpen ? (
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onBlur={() => !query && setSearchOpen(false)}
                placeholder="Search markets"
                aria-label="Search markets"
                className="pp-input h-9 w-40 py-1.5 text-sm sm:w-56"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search markets"
              className="pp-btn pp-btn-ghost px-2.5 py-2"
            >
              <SearchIcon />
            </button>
          )}

          <ConnectWalletButton compact />

          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            className="pp-btn pp-btn-ghost px-2.5 py-2 md:hidden"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="pp-fade fixed inset-x-0 top-14 z-40 border-b sm:top-16 border-[var(--color-border-subtle)] bg-[var(--color-bg)] md:hidden">
          <nav aria-label="Mobile" className="flex flex-col p-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-[var(--radius-control)] px-3 py-3.5 text-[15px] font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-[var(--color-surface-2)] text-[var(--color-text)]"
                    : "text-[var(--color-muted)]",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2.5 5h13M2.5 9h13M2.5 13h13" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 4l10 10M14 4L4 14" />
    </svg>
  );
}
