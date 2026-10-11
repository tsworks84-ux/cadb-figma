"use client";

import clsx from "clsx";
import { Activity, Building2, ClipboardCheck, FolderKanban, GraduationCap, Layers, LogOut, Menu, UserCircle, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { authCall } from "@/lib/api";
import { useMe } from "@/lib/queries";

const NAV = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/batches", label: "Batches", icon: Layers },
  { href: "/data-quality", label: "Data quality", icon: ClipboardCheck },
  { href: "/partners", label: "Partners", icon: Building2 },
  { href: "/boards", label: "Boards", icon: GraduationCap },
  { href: "/activity", label: "Activity", icon: Activity },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={clsx(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
              active ? "bg-brand-soft text-brand-dark" : "text-ink-soft hover:bg-canvas hover:text-ink",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Footer({ onNavigate }: { onNavigate?: () => void }) {
  const { data: me } = useMe();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    await authCall("/api/auth/logout", {}).catch(() => undefined);
    router.replace("/login");
  };
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-3">
      <Link href="/account" onClick={onNavigate} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-ink-soft hover:bg-canvas hover:text-ink">
        <UserCircle className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink">{me?.name ?? "Account"}</span>
          {me && <span className="block truncate text-xs text-ink-muted">{me.role === "OWNER" ? "Owner" : "Manager"}</span>}
        </span>
      </Link>
      <button onClick={signOut} disabled={busy} className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-ink-soft hover:bg-canvas hover:text-ink">
        <LogOut className="h-4 w-4 shrink-0" aria-hidden /> Sign out
      </button>
    </div>
  );
}

const Brand = () => (
  <div className="px-3">
    <p className="text-sm font-semibold text-ink">Partner Admin</p>
    <p className="text-xs text-ink-muted">Internal console</p>
  </div>
);

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useMe();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (me?.mustChangePassword && pathname !== "/account") router.replace("/account");
  }, [me, pathname, router]);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r border-line bg-white px-3 py-5 lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <Footer />
      </aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <p className="text-sm font-semibold text-ink">Partner Admin</p>
        <button onClick={() => setOpen(true)} className="rounded-md p-2 text-ink-soft hover:bg-canvas" aria-label="Open menu" aria-expanded={open}>
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 bg-white px-3 py-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button onClick={() => setOpen(false)} className="rounded-md p-2 text-ink-soft hover:bg-canvas" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <Footer onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
