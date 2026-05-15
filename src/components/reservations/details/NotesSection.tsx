import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, AlertCircle } from "lucide-react";
import type { NotesSectionProps } from "@/types";
import { useDebounce } from "@/hooks/useDebounce";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Sekcja z notatkami o rezerwacji, edytowalna z auto-save.
 */
export function NotesSection({ reservationId, initialNotes, isEditable, onSave }: NotesSectionProps) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const debouncedNotes = useDebounce(notes, 1000);

  const MAX_LENGTH = 1000;
  const showCounter = notes.length >= 900;

  // Auto-save effect
  useEffect(() => {
    const shouldSave = debouncedNotes !== (initialNotes || "") && isEditable && saveState !== "saving";

    if (shouldSave) {
      handleSave(debouncedNotes);
    }
  }, [debouncedNotes]);

  const handleSave = async (value: string) => {
    setSaveState("saving");
    try {
      await onSave(value);
      setSaveState("saved");
      // Reset to idle after 2 seconds
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (error) {
      setSaveState("error");
      console.error("Failed to save notes:", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_LENGTH) {
      setNotes(value);
    }
  };

  // Force save on Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (notes !== (initialNotes || "") && isEditable) {
          handleSave(notes);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [notes, initialNotes, isEditable]);

  const SaveIndicator = () => {
    if (saveState === "saving") {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Zapisywanie...</span>
        </div>
      );
    }

    if (saveState === "saved") {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Check className="h-4 w-4" />
          <span>Zapisano</span>
        </div>
      );
    }

    if (saveState === "error") {
      return (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Błąd zapisu</span>
        </div>
      );
    }

    return null;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Notatki</CardTitle>
        <SaveIndicator />
      </CardHeader>
      <CardContent>
        <Textarea
          value={notes}
          onChange={handleChange}
          disabled={!isEditable}
          placeholder="Dodaj notatki o rezerwacji..."
          className="min-h-[120px] resize-y"
          maxLength={MAX_LENGTH}
        />
        {showCounter && (
          <p className="text-sm text-muted-foreground mt-2 text-right">
            {notes.length} / {MAX_LENGTH}
          </p>
        )}
        {!isEditable && (
          <p className="text-sm text-muted-foreground mt-2">
            Edycja notatek jest dostępna tylko dla aktywnych rezerwacji
          </p>
        )}
      </CardContent>
    </Card>
  );
}
