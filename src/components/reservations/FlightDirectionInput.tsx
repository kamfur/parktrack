import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFormField } from "@/components/ui/form";
import { useFlightDirections } from "@/hooks/useFlightDirections";
import { filterFlightDirections } from "@/lib/reservations/flight-directions";
import { cn } from "@/lib/utils";

interface FlightDirectionInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

export function FlightDirectionInput({
  value,
  onChange,
  onBlur,
  name,
  disabled,
  placeholder = "np. Londyn, LO 392",
  maxLength = 100,
  className,
}: FlightDirectionInputProps) {
  const { formItemId, error, formDescriptionId, formMessageId } = useFormField();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const saved = useFlightDirections();
  const options = useMemo(() => filterFlightDirections(saved, value), [saved, value]);

  useEffect(() => {
    setHighlighted(0);
  }, [options]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const selectOption = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  const showList = open && !disabled && options.length > 0;

  return (
    <div ref={rootRef} className="relative">
      <Input
        id={formItemId}
        name={name}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={!!error}
        aria-describedby={!error ? formDescriptionId : `${formDescriptionId} ${formMessageId}`}
        className={cn("pr-8", className)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          onBlur?.();
          if (!rootRef.current?.contains(event.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (!options.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setHighlighted((index) => (index + 1) % options.length);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setHighlighted((index) => (index - 1 + options.length) % options.length);
            return;
          }
          if (event.key === "Enter" && open) {
            event.preventDefault();
            const option = options[highlighted];
            if (option) selectOption(option);
          }
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || saved.length === 0}
        aria-label="Pokaż zapisane kierunki lotu"
        className="absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronsUpDown className="size-4" aria-hidden="true" />
      </button>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
        >
          {options.map((option, index) => (
            <li key={option} role="option" aria-selected={index === highlighted}>
              <button
                type="button"
                className={cn(
                  "w-full rounded-sm px-2 py-1.5 text-left",
                  index === highlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => selectOption(option)}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
