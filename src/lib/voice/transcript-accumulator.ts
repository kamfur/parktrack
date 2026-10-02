import type { TranscriptUpdate } from "./transcript-source";
import type { VoiceTokenSpan } from "./types";

export interface StreamToken {
  text: string;
  is_final: boolean;
  confidence: number;
}

/** Soniox control markers — endpoint detection and manual finalization. */
const CONTROL_TOKENS = new Set(["<end>", "<fin>"]);

/**
 * Accumulates Soniox real-time tokens: final tokens are appended once (Soniox never resends
 * them), non-final tokens replace the partial tail on every result.
 */
export class TranscriptAccumulator {
  private finalText = "";
  private finalTokens: VoiceTokenSpan[] = [];
  private partialText = "";

  push(tokens: readonly StreamToken[]): TranscriptUpdate {
    let partial = "";
    for (const token of tokens) {
      if (CONTROL_TOKENS.has(token.text)) continue;
      if (token.is_final) {
        const start = this.finalText.length;
        this.finalText += token.text;
        this.finalTokens.push({ start, end: this.finalText.length, confidence: token.confidence });
      } else {
        partial += token.text;
      }
    }
    this.partialText = partial;
    return this.snapshot();
  }

  /** Appends a whole final segment (fake source / tests). */
  pushFinalText(text: string, confidence = 1): TranscriptUpdate {
    return this.push([{ text, is_final: true, confidence }]);
  }

  snapshot(): TranscriptUpdate {
    return { finalText: this.finalText, partialText: this.partialText, finalTokens: [...this.finalTokens] };
  }
}
