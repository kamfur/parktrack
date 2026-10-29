import { Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VoiceSessionState } from "@/hooks/useVoiceSession";
import { isVoiceEnabled } from "@/lib/voice/get-transcript-source";
import { cn } from "@/lib/utils";

interface VoiceCaptureButtonProps {
  state: VoiceSessionState;
  onStart(): void;
  onStop(): void;
  /** "lg" for the mobile driver dialog. */
  size?: "default" | "lg";
  className?: string;
}

/** Start/stop dictation. Renders nothing unless PUBLIC_VOICE_ENABLED=true. */
export function VoiceCaptureButton({ state, onStart, onStop, size = "default", className }: VoiceCaptureButtonProps) {
  if (!isVoiceEnabled()) return null;

  const active = state === "connecting" || state === "listening";
  const busy = state === "connecting" || state === "stopping";

  return (
    <Button
      type="button"
      variant={active ? "destructive" : "outline"}
      size={size}
      aria-pressed={active}
      disabled={state === "stopping"}
      onClick={active ? onStop : onStart}
      className={cn(size === "lg" && "h-12 text-base", className)}
    >
      {busy ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : active ? (
        <Square aria-hidden="true" />
      ) : (
        <Mic aria-hidden="true" />
      )}
      {state === "connecting" ? "Łączenie…" : state === "listening" ? "Słucham… (zatrzymaj)" : "Dyktuj"}
    </Button>
  );
}
