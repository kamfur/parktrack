import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeSource } from "./fake-source";
import { TranscriptAccumulator } from "./transcript-accumulator";
import { VoiceNotConfiguredError, toVoiceError, voiceError, type TranscriptUpdate } from "./transcript-source";

describe("TranscriptAccumulator", () => {
  it("appends final tokens with offsets and replaces the partial tail", () => {
    const acc = new TranscriptAccumulator();
    acc.push([
      { text: "Pan", is_final: true, confidence: 0.9 },
      { text: " Tom", is_final: false, confidence: 0.5 },
    ]);
    const u = acc.push([
      { text: " Tomasz", is_final: true, confidence: 0.6 },
      { text: " Wró", is_final: false, confidence: 0.4 },
    ]);
    expect(u.finalText).toBe("Pan Tomasz");
    expect(u.partialText).toBe(" Wró");
    expect(u.finalTokens).toEqual([
      { start: 0, end: 3, confidence: 0.9 },
      { start: 3, end: 10, confidence: 0.6 },
    ]);
  });

  it("skips <end> and <fin> control tokens", () => {
    const acc = new TranscriptAccumulator();
    const u = acc.push([
      { text: "garaż", is_final: true, confidence: 1 },
      { text: "<end>", is_final: true, confidence: 1 },
      { text: "<fin>", is_final: true, confidence: 1 },
    ]);
    expect(u.finalText).toBe("garaż");
    expect(u.finalTokens).toHaveLength(1);
  });
});

describe("createFakeSource", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits scripted steps as accumulated final text, then ends on stop", async () => {
    vi.useFakeTimers();
    const updates: TranscriptUpdate[] = [];
    const onEnd = vi.fn();
    const source = createFakeSource([
      { finalText: "Pan Tomasz Wróblewski, ", delayMs: 100 },
      { finalText: "garaż.", partialText: "gar", delayMs: 100 },
    ]);
    await source.start({ onUpdate: (u) => updates.push(u), onError: vi.fn(), onEnd });
    await vi.advanceTimersByTimeAsync(250);

    expect(updates.map((u) => u.partialText)).toContain("gar");
    expect(updates[updates.length - 1].finalText).toBe("Pan Tomasz Wróblewski, garaż.");
    await source.stop();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("emits nothing after cancel", async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const source = createFakeSource([{ finalText: "x", delayMs: 100 }]);
    await source.start({ onUpdate, onError: vi.fn(), onEnd: vi.fn() });
    source.cancel();
    await vi.advanceTimersByTimeAsync(200);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("toVoiceError", () => {
  const named = (name: string, code?: string) => Object.assign(new Error("x"), { name, code });

  it("maps SDK and browser errors to voice error codes", () => {
    expect(toVoiceError(new VoiceNotConfiguredError()).code).toBe("not_configured");
    expect(toVoiceError(named("AuthError", "auth_error")).code).toBe("not_configured");
    expect(toVoiceError(named("AudioPermissionError")).code).toBe("permission_denied");
    expect(toVoiceError(named("NotAllowedError")).code).toBe("permission_denied");
    expect(toVoiceError(named("QuotaError", "quota_exceeded")).code).toBe("quota");
    expect(toVoiceError(named("NetworkError", "network_error")).code).toBe("network");
    expect(toVoiceError(new Error("boom")).code).toBe("unknown");
  });

  it("passes an existing VoiceError through", () => {
    const e = voiceError("network");
    expect(toVoiceError(e)).toBe(e);
  });
});
