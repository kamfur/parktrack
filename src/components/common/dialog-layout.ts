/**
 * Below `sm` (phones) dialogs fill the whole screen instead of floating in the middle:
 * no insets, rounding or centering transform, and no slide-from-center animation.
 * Pass to `DialogContent` via `cn(MOBILE_FULLSCREEN_DIALOG, ...)` — `ui/dialog.tsx` stays untouched.
 */
export const MOBILE_FULLSCREEN_DIALOG = [
  "max-sm:inset-0 max-sm:left-0 max-sm:top-0 max-sm:translate-x-0 max-sm:translate-y-0",
  "max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:content-start",
  "max-sm:rounded-none max-sm:border-0 max-sm:shadow-none",
  "max-sm:data-[state=open]:slide-in-from-left-0 max-sm:data-[state=open]:slide-in-from-top-0",
  "max-sm:data-[state=closed]:slide-out-to-left-0 max-sm:data-[state=closed]:slide-out-to-top-0",
].join(" ");
