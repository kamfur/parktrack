import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { AnalyticsData } from "@/types";
import { formatBucket, formatPln } from "./chart-format";

const config = { revenue: { label: "Przychód", color: "var(--chart-2)" } } satisfies ChartConfig;

export function RevenueChart({ data }: { data: AnalyticsData }) {
  const { granularity } = data.range;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Przychód w czasie</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-72 w-full">
          <BarChart data={data.revenue.series} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              minTickGap={16}
              tickFormatter={(bucket: string) => formatBucket(bucket, granularity)}
            />
            <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={formatPln} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) =>
                    formatBucket(String(payload?.[0]?.payload?.bucket), granularity, true)
                  }
                  formatter={(value) => formatPln(Number(value))}
                />
              }
            />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={3} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
