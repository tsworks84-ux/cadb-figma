"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { resolvePhotoUrl } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { ACADEMICS_TABS, canViewAcademicsTab } from "@/lib/academicsAccess";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { NotificationBell } from "@/components/layout/NotificationBell";

const NAV_BG   = "#141735";
const NAV2     = "#28245f";
const ORANGE   = "#ff914d";

export function AcademicsTopNav() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const teacherId    = searchParams.get("teacherId");
  const { user }    = useAuthStore();
  const permissions = usePermissions();

  // Build href preserving teacherId query param
  const buildHref = (href: string) => teacherId ? `${href}?teacherId=${teacherId}` : href;

  const visibleItems = ACADEMICS_TABS.filter(({ module, name }) => {
    // A teacher-scoped view never exposes global Academic Settings.
    if (teacherId && name === "Settings") return false;
    return canViewAcademicsTab(user?.role, permissions, module);
  });

  return (
    <header
      className="shrink-0 flex items-center justify-between border-b"
      style={{
        height: 72,
        background: NAV_BG,
        borderColor: "rgba(255,255,255,.10)",
        color: "white",
        padding: "0 28px",
      }}
    >
      {/* ── Brand ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-[13px] shrink-0" style={{ minWidth: 220 }}>
        <Image
          src="/logo.png"
          alt="Centum Academy"
          width={38}
          height={38}
          className="rounded-full shrink-0 object-cover"
        />
        <div>
          <strong className="block text-[18px] font-black leading-tight tracking-tight">
            Academics
          </strong>
          <span className="block text-[12px] font-bold" style={{ color: "#c7d2fe" }}>
            Centum Academy
          </span>
        </div>
      </div>

      {/* ── Tabs (hidden below lg) ─────────────────────────────────────────────── */}
      <nav className="hidden lg:flex items-stretch self-stretch flex-1 gap-0.5 overflow-x-auto scrollbar-none">
        {visibleItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={buildHref(item.href)}
              className="flex items-center px-[14px] text-sm whitespace-nowrap border-b-[3px] transition-colors duration-150"
              style={{
                fontWeight: 850,
                color: active ? "white" : "#aab3c5",
                borderBottomColor: active ? ORANGE : "transparent",
                background: active ? "rgba(255,255,255,.05)" : "transparent",
              }}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* ── Admin / User ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Link
          href="/dashboard/home"
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-extrabold mr-2 transition-colors hover:bg-white/15"
          style={{ color: "#e2e8f0", borderColor: "rgba(255,255,255,.20)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        {/* Mobile: icon-only back */}
        <Link
          href="/dashboard/home"
          className="md:hidden flex items-center text-slate-400 hover:text-white transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <NotificationBell tone="dark" />

        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 overflow-hidden"
          style={{ background: "#eef2ff", color: NAV2 }}
        >
          <img
            src={user?.photoUrl ? resolvePhotoUrl(user.photoUrl)! : "/default-avatar.svg"}
            alt="avatar"
            className="h-full w-full object-cover"
          />
        </div>

        <span className="hidden sm:block text-[13px] font-bold" style={{ color: "#e5e7eb" }}>
          {user ? `${user.firstName} ${user.lastName}` : ""}
        </span>
      </div>

      {/* ── Mobile tab strip (shown below lg) ─────────────────────────────────── */}
      {/* Rendered as a separate fixed-below element via sibling — handled in layout */}
    </header>
  );
}

/** Scrollable tab strip shown on small screens below the main header. */
export function AcademicsMobileTabStrip() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const teacherId    = searchParams.get("teacherId");
  const { user }    = useAuthStore();
  const permissions = usePermissions();

  const buildHref = (href: string) => teacherId ? `${href}?teacherId=${teacherId}` : href;

  const visibleItems = ACADEMICS_TABS.filter(({ module, name }) => {
    if (teacherId && name === "Settings") return false;
    return canViewAcademicsTab(user?.role, permissions, module);
  });

  return (
    <nav
      className="lg:hidden flex items-end gap-0 overflow-x-auto scrollbar-none shrink-0 border-b"
      style={{ background: NAV_BG, borderColor: "rgba(255,255,255,.10)" }}
    >
      {visibleItems.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={buildHref(item.href)}
            className="flex items-center px-4 py-3 text-[13px] whitespace-nowrap border-b-[3px] transition-colors duration-150"
            style={{
              fontWeight: 850,
              color: active ? "white" : "#aab3c5",
              borderBottomColor: active ? ORANGE : "transparent",
              background: active ? "rgba(255,255,255,.05)" : "transparent",
            }}
          >
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
