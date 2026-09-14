import { z } from "zod";

const isoInstant = z.string().datetime({ offset: true });

const rangeSchema = z.object({
  from: isoInstant,
  to: isoInstant,
});

function validateRange({ from, to }: { from: string; to: string }, ctx: z.RefinementCtx): void {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (end <= start) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "to must be after from" });
    return;
  }
  if (end - start > 93 * 24 * 60 * 60 * 1000) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "range cannot exceed 93 days" });
  }
}

export const calendarRangeQuerySchema = rangeSchema
  .extend({ view: z.enum(["day", "week", "month"]) })
  .superRefine(({ from, to }, ctx) => {
    validateRange({ from, to }, ctx);
  });

export const shiftRangeQuerySchema = rangeSchema.superRefine(validateRange);

export const driverShiftWriteSchema = z
  .object({
    driver_user_id: z.string().uuid(),
    starts_at: isoInstant,
    ends_at: isoInstant,
  })
  .superRefine(({ starts_at, ends_at }, ctx) => {
    if (Date.parse(ends_at) <= Date.parse(starts_at)) {
      ctx.addIssue({ code: "custom", path: ["ends_at"], message: "ends_at must be after starts_at" });
    }
  });

export const idSchema = z.string().uuid();

export type CalendarRangeQuery = z.infer<typeof calendarRangeQuerySchema>;
export type ShiftRangeQuery = z.infer<typeof shiftRangeQuerySchema>;
export type DriverShiftWrite = z.infer<typeof driverShiftWriteSchema>;
