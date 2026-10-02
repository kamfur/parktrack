import { useCallback, useEffect, useRef, useState } from "react";
import {
  planVoiceUpdates,
  plateNeedsConfirmation,
  type AppliedVoiceValues,
  type ProvenanceMap,
  type VoiceFieldKey,
} from "@/lib/voice/merge";
import type { ParsedVoiceFields } from "@/lib/voice/types";

export interface VoiceFieldMeta {
  lowConfidence: boolean;
  formatWarning?: boolean;
}

export interface VoiceFormFill {
  provenance: ProvenanceMap;
  meta: Partial<Record<VoiceFieldKey, VoiceFieldMeta>>;
  /** Call from the field's user onChange — voice will never overwrite it again. */
  markManual(key: VoiceFieldKey): void;
  needsPlateConfirmation: boolean;
  confirmPlate(): void;
}

/**
 * Applies parsed dictation to a form under the provenance rules: voice fills `empty` and `voice`
 * fields, never `manual` ones; a voice-filled plate must be confirmed (or edited) before submit.
 * `apply` performs the form writes (setValue) for the planned updates.
 */
export function useVoiceFormFill(options: {
  parsed: ParsedVoiceFields | undefined;
  apply: (updates: Partial<ParsedVoiceFields>) => void;
  initialManual?: readonly VoiceFieldKey[];
}): VoiceFormFill {
  const { parsed, apply, initialManual } = options;
  const [provenance, setProvenance] = useState<ProvenanceMap>(() =>
    Object.fromEntries((initialManual ?? []).map((k) => [k, "manual"]))
  );
  const [meta, setMeta] = useState<Partial<Record<VoiceFieldKey, VoiceFieldMeta>>>({});
  const [plateConfirmed, setPlateConfirmed] = useState(false);

  const provenanceRef = useRef(provenance);
  const appliedRef = useRef<AppliedVoiceValues>({});
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  }, [apply]);

  useEffect(() => {
    if (!parsed) return;
    const { updates, nextProvenance } = planVoiceUpdates(parsed, provenanceRef.current, appliedRef.current);
    const keys = Object.keys(updates) as VoiceFieldKey[];
    if (!keys.length) return;

    applyRef.current(updates);
    for (const key of keys) appliedRef.current[key] = updates[key]?.value;
    provenanceRef.current = nextProvenance;
    setProvenance(nextProvenance);
    setMeta((prev) => {
      const next = { ...prev };
      for (const key of keys) {
        const f = updates[key];
        if (!f) continue;
        next[key] = {
          lowConfidence: f.lowConfidence,
          formatWarning: "formatWarning" in f ? Boolean(f.formatWarning) : undefined,
        };
      }
      return next;
    });
    if (updates.licensePlate) setPlateConfirmed(false);
  }, [parsed]);

  const markManual = useCallback((key: VoiceFieldKey) => {
    if (provenanceRef.current[key] === "manual") return;
    const next = { ...provenanceRef.current, [key]: "manual" as const };
    provenanceRef.current = next;
    setProvenance(next);
  }, []);

  const confirmPlate = useCallback(() => setPlateConfirmed(true), []);

  return {
    provenance,
    meta,
    markManual,
    needsPlateConfirmation: plateNeedsConfirmation(provenance, plateConfirmed),
    confirmPlate,
  };
}
