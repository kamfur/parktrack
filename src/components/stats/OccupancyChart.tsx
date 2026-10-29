import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AnalyticsData } from "@/types";
import { formatBucket } from "./chart-format";

const config = {
  actual: { label: "Obłożenie", color: "var(--chart-1)" },
  forecast: { label: "Prognoza (rezerwacje potwierdzone)", color: "var(--chart-4)" },
} satisfies ChartConfig;

/** Splits the series in two lines; the last actual point is repeated so the forecast line connects. */
function toChartRows(series: AnalyticsData["occupancy"]["series"]) {
  return series.map((point, index) => ({
    bucket: point.bucket,
    occupied: point.occupied,
    actual: point.forecast ? null : point.occupancyPct,
    forecast: point.forecast || (series[index + 1]?.forecast ?? false) ? point.occupancyPct : null,
  }));
}

export function OccupancyChart({ data }: { data: AnalyticsData }) {
  const { granularity } = data.range;
  const rows = toChartRows(data.occupancy.series);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Obłożenie parkingu</CardTitle>
        <CardDescription>
          % z {data.occupancy.totalSpots} miejsc, szczyt w okresie: {data.occupancy.peakPct}%
          {granularity === "month" ? " (średnia z miesiąca)" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-72 w-full">
          <LineChart data={rows} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              minTickGap={16}
              tickFormatter={(bucket: string) => formatBucket(bucket, granularity)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              domain={[0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)]}
              tickFormatter={(value: number) => `${value}%`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    formatBucket(String(payload?.[0]?.payload?.bucket), granularity, true)
                  }
                  formatter={(value) => `${value}%`}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line dataKey="actual" type="monotone" stroke="var(--color-actual)" strokeWidth={2} dot={false} />
            <Line
              dataKey="forecast"
              type="monotone"
              stroke="var(--color-forecast)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
