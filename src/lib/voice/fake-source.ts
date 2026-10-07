import { TranscriptAccumulator } from "./transcript-accumulator";
import type { TranscriptSource, TranscriptSourceHandlers } from "./transcript-source";

export interface FakeVoiceStep {
  /** Appended as a new final segment. */
  finalText: string;
  /** Shown as the partial tail before this step's final text lands. */
  partialText?: string;
  /** Wait before emitting this step. @default 50 */
  delayMs?: number;
}

declare global {
  interface Window {
    /** E2E only (PUBLIC_VOICE_FAKE=true): scripted dictation for the fake transcript source. */
    __parktrackFakeVoice?: FakeVoiceStep[];
  }
}

/** Scripted transcript source for E2E — no microphone, no network. */
export function createFakeSource(steps: readonly FakeVoiceStep[] = []): TranscriptSource {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let handlers: TranscriptSourceHandlers | null = null;

  return {
    async start(h) {
      handlers = h;
      const accumulator = new TranscriptAccumulator();
      let at = 0;
      for (const step of steps) {
        at += step.delayMs ?? 50;
        if (step.partialText) {
          const partialAt = at;
          timers.push(
            setTimeout(
              () => h.onUpdate({ ...accumulator.snapshot(), partialText: step.partialText ?? "" }),
              Math.max(0, partialAt - 25)
            )
          );
        }
        timers.push(setTimeout(() => h.onUpdate(accumulator.pushFinalText(step.finalText)), at));
      }
    },
    async stop() {
      timers.forEach(clearTimeout);
      handlers?.onEnd();
      handlers = null;
    },
    cancel() {
      timers.forEach(clearTimeout);
      handlers = null;
    },
  };
}
