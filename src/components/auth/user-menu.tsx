import { useState } from "react";
import { Loader2, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuthUserDTO } from "@/types";

interface UserMenuProps {
  user: AuthUserDTO;
}

function navigateTo(url: string) {
  globalThis.location.assign(url);
}

export function UserMenu({ user }: UserMenuProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Redirect anyway — middleware will require a fresh login.
    } finally {
      navigateTo("/login");
    }
  };

  return (
    <div className="mt-auto border-t border-sidebar-border p-3 space-y-2">
      <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-sidebar-foreground">
        <User className="h-4 w-4 shrink-0" />
        <span className="truncate" title={user.email}>
          {user.email}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        Wyloguj
      </Button>
    </div>
  );
}
