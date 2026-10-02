import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { warsawDateKey } from "@/lib/calendar/warsaw-time";
import { getTranscriptSource } from "@/lib/voice/get-transcript-source";
import { parseReservationTranscript, type ParsedVoiceFields } from "@/lib/voice/parse-transcript";
import {
  toVoiceError,
  type TranscriptSource,
  type TranscriptUpdate,
  type VoiceError,
} from "@/lib/voice/transcript-source";

export type VoiceSessionState = "idle" | "connecting" | "listening" | "stopping" | "error";

/** Hard cap so a forgotten session does not keep streaming (Soniox bills stream time). */
export const VOICE_MAX_SESSION_MS = 10 * 60 * 1000;

const EMPTY: TranscriptUpdate = { finalText: "", partialText: "", finalTokens: [] };

interface WakeLockSentinelLike {
  release(): Promise<void>;
}

async function requestWakeLock(): Promise<WakeLockSentinelLike | null> {
  try {
    const wakeLock = (
      navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> } }
    ).wakeLock;
    return (await wakeLock?.request("screen")) ?? null;
  } catch {
    return null; // Not supported or denied — dictation still works, the screen may just dim.
  }
}

export interface VoiceSession {
  state: VoiceSessionState;
  error?: VoiceError;
  finalText: string;
  partialText: string;
  parsed: ParsedVoiceFields;
  start(): Promise<void>;
  stop(): Promise<void>;
  cancel(): void;
}

/**
 * Owns one dictation session: source lifecycle, 10-minute cap, wake lock and reconnect on
 * wake. `parsed` is recomputed from the whole final transcript on every update.
 */
export function useVoiceSession(options?: { today?: string }): VoiceSession {
  const [state, setState] = useState<VoiceSessionState>("idle");
  const [error, setError] = useState<VoiceError | undefined>();
  const [transcript, setTranscript] = useState<TranscriptUpdate>(EMPTY);

  const sourceRef = useRef<TranscriptSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  const releaseResources = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    void wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    sourceRef.current?.cancel();
    sourceRef.current = null;
    releaseResources();
    setState((s) => (s === "error" ? s : "idle"));
  }, [releaseResources]);

  const stop = useCallback(async () => {
    const source = sourceRef.current;
    if (!source) return;
    setState("stopping");
    try {
      await source.stop();
    } finally {
      sourceRef.current = null;
      releaseResources();
      setState((s) => (s === "error" ? s : "idle"));
    }
  }, [releaseResources]);

  const start = useCallback(async () => {
    if (sourceRef.current) return;
    setError(undefined);
    setTranscript(EMPTY);
    setState("connecting");
    try {
      const source = await getTranscriptSource();
      sourceRef.current = source;
      await source.start({
        onUpdate: setTranscript,
        onError: (e) => {
          setError(e);
          setState("error");
          sourceRef.current?.cancel();
          sourceRef.current = null;
          releaseResources();
        },
        onEnd: () => undefined,
      });
      if (sourceRef.current !== source) return; // cancelled while connecting
      setState("listening");
      wakeLockRef.current = await requestWakeLock();
      timerRef.current = setTimeout(() => void stop(), VOICE_MAX_SESSION_MS);
    } catch (e) {
      sourceRef.current?.cancel();
      sourceRef.current = null;
      releaseResources();
      setError(toVoiceError(e));
      setState("error");
    }
  }, [releaseResources, stop]);

  // Laptop sleep / phone screen lock drops the socket; reconnect and re-take the wake lock.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible" || !sourceRef.current) return;
      sourceRef.current.reconnect?.();
      void requestWakeLock().then((lock) => {
        wakeLockRef.current = lock;
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Closing the form must end the session.
  useEffect(() => cancel, [cancel]);

  const today = options?.today;
  const parsed = useMemo(
    () =>
      parseReservationTranscript(transcript.finalText, {
        today: today ?? warsawDateKey(new Date()),
        tokens: transcript.finalTokens,
      }),
    [transcript.finalText, transcript.finalTokens, today]
  );

  return {
    state,
    error,
    finalText: transcript.finalText,
    partialText: transcript.partialText,
    parsed,
    start,
    stop,
    cancel,
  };
}
