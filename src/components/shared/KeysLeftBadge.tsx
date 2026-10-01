import { KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Marks a stay whose client left the car keys with the parking at arrival. */
export function KeysLeftBadge() {
  return (
    <Badge className="gap-1 bg-amber-100 text-amber-900 hover:bg-amber-100" title="Klient zostawił kluczyki">
      <KeyRound className="h-3.5 w-3.5" aria-hidden />
      Kluczyki
    </Badge>
  );
}
