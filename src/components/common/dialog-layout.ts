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

/**
 * Phones AND tablets (below `lg`, i.e. up to 1023px) get a fullscreen form: a floating dialog
 * on a tablet leaves a cramped column of small controls. `!` beats the base `sm:rounded-lg`
 * and the dialogs' own `sm:`/`md:` size caps, which would otherwise win between 640 and 1023px.
 * Use for the reservation forms; other dialogs keep `MOBILE_FULLSCREEN_DIALOG`.
 */
export const TABLET_FULLSCREEN_DIALOG = [
  "max-lg:inset-0 max-lg:left-0 max-lg:top-0 max-lg:translate-x-0 max-lg:translate-y-0",
  "max-lg:h-dvh max-lg:max-h-dvh! max-lg:w-full max-lg:max-w-none! max-lg:content-start",
  "max-lg:rounded-none! max-lg:border-0 max-lg:shadow-none",
  "max-lg:data-[state=open]:slide-in-from-left-0 max-lg:data-[state=open]:slide-in-from-top-0",
  "max-lg:data-[state=closed]:slide-out-to-left-0 max-lg:data-[state=closed]:slide-out-to-top-0",
].join(" ");

/**
 * Horizontal gutter for a fullscreen form: full-width fields on a tablet are hard to scan, so the
 * content is kept in a centred ~42rem column (never less than 1.5rem on a phone).
 */
export const TABLET_FORM_GUTTER = "max-lg:px-[max(1.5rem,calc((100vw-42rem)/2))]";

/** Negative margin matching `TABLET_FORM_GUTTER`, for a footer that must reach the dialog edges. */
export const TABLET_FORM_BLEED = "max-lg:-mx-[max(1.5rem,calc((100vw-42rem)/2))]";

/**
 * Bigger type and touch targets for forms used on a tablet (below `lg`): 16px labels and inputs,
 * 48px fields, select triggers and submit buttons, stronger section headings and a larger title.
 */
export const TOUCH_FORM_READABILITY = [
  "max-lg:[&_h2]:text-xl max-lg:[&_h3]:text-base max-lg:[&_h3]:font-semibold max-lg:[&_h3]:text-neutral-900",
  "max-lg:[&_label]:text-base max-lg:[&_label]:font-medium",
  "max-lg:[&_input]:min-h-12 max-lg:[&_input]:text-base max-lg:[&_textarea]:text-base",
  "max-lg:[&_[role=combobox]]:min-h-12 max-lg:[&_[role=combobox]]:text-base",
  "max-lg:[&_button[type=submit]]:min-h-12 max-lg:[&_button[type=submit]]:text-base",
].join(" ");
