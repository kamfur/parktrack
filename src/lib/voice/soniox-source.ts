import { SonioxClient, type Recording, type SonioxConnectionConfig } from "@soniox/client";
import { SONIOX_CONTEXT, SONIOX_MAX_ENDPOINT_DELAY_MS, SONIOX_MODEL } from "./soniox-context";
import { TranscriptAccumulator } from "./transcript-accumulator";
import {
  VoiceNotConfiguredError,
  toVoiceError,
  type TranscriptSource,
  type TranscriptSourceHandlers,
} from "./transcript-source";

/** Fetches a fresh temporary key + region from our backend for every recording. */
async function fetchConnectionConfig(): Promise<SonioxConnectionConfig> {
  const res = await fetch("/api/voice/token", { method: "POST" });
  if (res.status === 503) throw new VoiceNotConfiguredError();
  if (!res.ok) throw Object.assign(new Error(`voice token HTTP ${res.status}`), { code: "connection_error" });
  const body = (await res.json()) as { api_key: string; region: "eu" | "us" };
  return { api_key: body.api_key, region: body.region === "eu" ? "eu" : undefined };
}

/** Soniox real-time over the browser microphone (`@soniox/client`). Loaded lazily. */
export function createSonioxSource(): TranscriptSource {
  let recording: Recording | null = null;

  return {
    start(handlers: TranscriptSourceHandlers) {
      const accumulator = new TranscriptAccumulator();
      const client = new SonioxClient({ config: fetchConnectionConfig });
      const rec = client.realtime.record({
        model: SONIOX_MODEL,
        language_hints: ["pl"],
        context: SONIOX_CONTEXT,
        enable_endpoint_detection: true,
        max_endpoint_delay_ms: SONIOX_MAX_ENDPOINT_DELAY_MS,
        client_reference_id: "parktrack-voice",
      });
      recording = rec;

      return new Promise<void>((resolve, reject) => {
        let connected = false;
        rec.on("connected", () => {
          connected = true;
          resolve();
        });
        rec.on("result", (result) => handlers.onUpdate(accumulator.push(result.tokens)));
        rec.on("error", (error) => {
          const voiceErr = toVoiceError(error);
          if (connected) handlers.onError(voiceErr);
          else reject(voiceErr);
        });
        rec.on("finished", () => handlers.onEnd());
      });
    },
    async stop() {
      await recording?.stop();
    },
    cancel() {
      recording?.cancel();
      recording = null;
    },
    reconnect() {
      recording?.reconnect();
    },
  };
}
