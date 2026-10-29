import { z } from "zod";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const MAX_DAYS_BY_GRANULARITY = { day: 93, month: 400 } as const;

/** Inclusive Warsaw date range (YYYY-MM-DD) for the staff analytics page. */
export const analyticsQuerySchema = z
  .object({
    from: dateKey,
    to: dateKey,
    granularity: z.enum(["day", "month"]).default("day"),
  })
  .superRefine(({ from, to, granularity }, ctx) => {
    const start = Date.parse(`${from}T00:00:00Z`);
    const end = Date.parse(`${to}T00:00:00Z`);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      ctx.addIssue({ code: "custom", path: ["from"], message: "Invalid date" });
      return;
    }
    if (end < start) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "to must not be before from" });
      return;
    }
    const days = Math.round((end - start) / 86_400_000) + 1;
    const max = MAX_DAYS_BY_GRANULARITY[granularity];
    if (days > max) {
      ctx.addIssue({ code: "custom", path: ["to"], message: `range cannot exceed ${max} days` });
    }
  });

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
