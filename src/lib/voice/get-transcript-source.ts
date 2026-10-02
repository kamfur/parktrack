import type { TranscriptSource } from "./transcript-source";

/** Voice UI is shown only when explicitly enabled for the deployment. */
export function isVoiceEnabled(): boolean {
  return import.meta.env.PUBLIC_VOICE_ENABLED === "true";
}

/**
 * Soniox in normal builds (SDK loaded lazily so it is not in every island bundle);
 * the scripted fake only when the build sets PUBLIC_VOICE_FAKE=true (E2E dev server).
 */
export async function getTranscriptSource(): Promise<TranscriptSource> {
  if (import.meta.env.PUBLIC_VOICE_FAKE === "true") {
    const { createFakeSource } = await import("./fake-source");
    return createFakeSource(window.__parktrackFakeVoice ?? []);
  }
  const { createSonioxSource } = await import("./soniox-source");
  return createSonioxSource();
}
