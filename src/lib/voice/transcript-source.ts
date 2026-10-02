import type { VoiceTokenSpan } from "./types";

export interface TranscriptUpdate {
  /** All finalized text so far (accumulated across segments). */
  finalText: string;
  /** Current non-final tail — preview only, never parsed into fields. */
  partialText: string;
  /** Final tokens with offsets into `finalText`. */
  finalTokens: VoiceTokenSpan[];
}

export type VoiceErrorCode = "permission_denied" | "not_configured" | "network" | "quota" | "unknown";

export interface VoiceError {
  code: VoiceErrorCode;
  message: string;
}

export interface TranscriptSourceHandlers {
  onUpdate(update: TranscriptUpdate): void;
  onError(error: VoiceError): void;
  onEnd(): void;
}

/** UI-facing abstraction over the STT engine (Soniox in prod, a scripted fake in E2E). */
export interface TranscriptSource {
  /** Resolves once audio is flowing to the engine; rejects with a VoiceError. */
  start(handlers: TranscriptSourceHandlers): Promise<void>;
  /** Graceful stop: flushes pending final tokens, then calls onEnd. */
  stop(): Promise<void>;
  /** Immediate teardown without waiting for results. */
  cancel(): void;
  /** Re-establish the connection after sleep/wake (optional). */
  reconnect?(): void;
}

/** Raised by the token fetch when /api/voice/token answers 503. */
export class VoiceNotConfiguredError extends Error {
  constructor() {
    super("voice_not_configured");
    this.name = "VoiceNotConfiguredError";
  }
}

const MESSAGES: Record<VoiceErrorCode, string> = {
  permission_denied: "Brak dostępu do mikrofonu. Zezwól na mikrofon w przeglądarce i spróbuj ponownie.",
  not_configured: "Dyktowanie jest niedostępne (brak konfiguracji usługi rozpoznawania mowy).",
  network: "Utracono połączenie z usługą rozpoznawania mowy. Spróbuj ponownie.",
  quota: "Przekroczono limit usługi rozpoznawania mowy.",
  unknown: "Dyktowanie nie powiodło się. Spróbuj ponownie.",
};

export function voiceError(code: VoiceErrorCode): VoiceError {
  return { code, message: MESSAGES[code] };
}

function isVoiceError(error: unknown): error is VoiceError {
  return (
    !!error &&
    typeof error === "object" &&
    !(error instanceof Error) &&
    "code" in error &&
    "message" in error &&
    String((error as { code: unknown }).code) in MESSAGES
  );
}

/** Maps SDK / browser errors by name and code (no SDK import, so it stays unit-testable). */
export function toVoiceError(error: unknown): VoiceError {
  if (isVoiceError(error)) return error;
  const name = error instanceof Error ? error.name : "";
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";

  if (name === "VoiceNotConfiguredError" || code === "auth_error") return voiceError("not_configured");
  if (
    name === "AudioPermissionError" ||
    name === "AudioDeviceError" ||
    name === "AudioUnavailableError" ||
    name === "NotAllowedError"
  ) {
    return voiceError("permission_denied");
  }
  if (code === "quota_exceeded") return voiceError("quota");
  if (code === "network_error" || code === "connection_error") return voiceError("network");
  return voiceError("unknown");
}
