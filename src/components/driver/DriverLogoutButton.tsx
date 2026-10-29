import { useState } from "react";
import { Loader2 } from "lucide-react";

export function DriverLogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Redirect anyway — middleware will require a fresh login.
    } finally {
      globalThis.location.assign("/login");
    }
  };

  return (
    <button
      type="button"
      className="min-h-11 rounded-md border border-border px-3 text-sm font-medium disabled:opacity-50"
      onClick={() => void handleLogout()}
      disabled={isLoggingOut}
    >
      {isLoggingOut ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Wyloguj"}
    </button>
  );
}
