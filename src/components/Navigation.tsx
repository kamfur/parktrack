import { useState } from "react";
import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  FileText,
  Settings,
  Menu,
  X,
  Car,
  Truck,
  LayoutGrid,
  Plane,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/auth/user-menu";
import type { AuthUserDTO } from "@/types";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kalendarz", label: "Kalendarz", icon: CalendarClock, staffOnly: true },
  { href: "/rezerwacje", label: "Rezerwacje", icon: CalendarDays },
  { href: "/faktury", label: "Faktury", icon: FileText, staffOnly: true },
  { href: "/biura-podrozy", label: "Biura podróży", icon: Plane, staffOnly: true },
  { href: "/garage-occupancy", label: "Obłożenie garaży", icon: LayoutGrid, staffOnly: true },
  { href: "/kierowca", label: "Kierowca", icon: Truck },
  { href: "/ustawienia", label: "Ustawienia", icon: Settings },
];

/** Kierowcy nie mają dostępu do faktur — pozycja znika z menu. */
function getNavItems(user: AuthUserDTO | null) {
  return navItems.filter((item) => !item.staffOnly || user?.role !== "driver");
}

function isActive(itemHref: string, currentPath: string) {
  if (itemHref === "/") return currentPath === "/";
  return currentPath.startsWith(itemHref);
}

function SidebarContent({
  currentPath,
  user,
  onNavigate,
}: {
  currentPath: string;
  user: AuthUserDTO | null;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border shrink-0">
        <Car className="h-5 w-5 text-sidebar-primary" />
        <span className="font-semibold text-sidebar-foreground">ParkTrack</span>
      </div>
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {getNavItems(user).map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(href, currentPath)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </a>
        ))}
      </nav>
      {user ? <UserMenu user={user} /> : null}
    </>
  );
}

export function Navigation({ currentPath, user }: { currentPath: string; user: AuthUserDTO | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-sidebar-border bg-sidebar">
        <SidebarContent currentPath={currentPath} user={user} />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-background shrink-0">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md text-foreground hover:bg-accent transition-colors"
          aria-label="Otwórz menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-primary" />
          <span className="font-semibold">ParkTrack</span>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed left-0 top-0 h-full w-60 z-50 md:hidden flex flex-col bg-sidebar border-r border-sidebar-border">
            <div className="flex items-center justify-between px-4 h-14 border-b border-sidebar-border shrink-0">
              <div className="flex items-center gap-2">
                <Car className="h-5 w-5 text-sidebar-primary" />
                <span className="font-semibold text-sidebar-foreground">ParkTrack</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                aria-label="Zamknij menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-3 flex-1">
              {getNavItems(user).map(({ href, label, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive(href, currentPath)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </a>
              ))}
            </nav>
            {user ? <UserMenu user={user} /> : null}
          </aside>
        </>
      )}
    </>
  );
}
