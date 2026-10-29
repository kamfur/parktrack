import { useVoiceSession } from "@/hooks/useVoiceSession";
import { TranscriptPreview } from "./TranscriptPreview";
import { VoiceCaptureButton } from "./VoiceCaptureButton";

/** Dev-only page (/dev/voice) to verify the real Soniox session and parser before form wiring. */
export default function VoiceHarness() {
  const voice = useVoiceSession();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Dyktowanie — test (dev)</h1>
      <div className="flex items-center gap-3">
        <VoiceCaptureButton state={voice.state} onStart={() => void voice.start()} onStop={() => void voice.stop()} />
        <span className="text-sm text-muted-foreground">stan: {voice.state}</span>
      </div>
      <TranscriptPreview
        state={voice.state}
        finalText={voice.finalText}
        partialText={voice.partialText}
        error={voice.error}
      />
      <pre aria-label="Rozpoznane pola" className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
        {JSON.stringify(
          Object.fromEntries(
            Object.entries(voice.parsed).map(([k, f]) => [k, { value: f.value, lowConfidence: f.lowConfidence }])
          ),
          null,
          2
        )}
      </pre>
    </div>
  );
}
