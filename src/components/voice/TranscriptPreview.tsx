import type { VoiceSessionState } from "@/hooks/useVoiceSession";
import type { VoiceError } from "@/lib/voice/transcript-source";

interface TranscriptPreviewProps {
  state: VoiceSessionState;
  finalText: string;
  partialText: string;
  error?: VoiceError;
}

/** What Soniox heard — final text plus the muted partial tail. Never stored. */
export function TranscriptPreview({ state, finalText, partialText, error }: TranscriptPreviewProps) {
  if (error) {
    return (
      <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
        {error.message}
      </p>
    );
  }
  if (state === "idle" && !finalText) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Transkrypcja dyktowania"
      className="max-h-28 overflow-y-auto rounded-md border bg-muted/40 p-2 text-sm"
    >
      {finalText || partialText ? (
        <>
          <span>{finalText}</span>
          {partialText && <span className="text-muted-foreground">{partialText}</span>}
        </>
      ) : (
        <span className="text-muted-foreground">Mów — pola wypełnią się po krótkiej pauzie.</span>
      )}
    </div>
  );
}
