import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Marks a field filled by dictation; the warning variant asks the user to double-check it. */
export function VoiceFieldBadge({ lowConfidence = false, className }: { lowConfidence?: boolean; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        lowConfidence
          ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
          : "border-sky-400 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
        className
      )}
    >
      {lowConfidence ? "z głosu — sprawdź" : "z głosu"}
    </Badge>
  );
}
