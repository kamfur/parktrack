import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { AnalyticsBreakdownItem, AnalyticsData } from "@/types";
import { CUSTOMER_LABELS, PARKING_TYPE_LABELS, SOURCE_LABELS } from "./chart-format";

interface BreakdownCardProps {
  title: string;
  items: AnalyticsBreakdownItem[];
  labels?: Record<string, string>;
  color: string;
}

function BreakdownCard({ title, items, labels, color }: BreakdownCardProps) {
  const config = { count: { label: "Rezerwacje", color } } satisfies ChartConfig;
  const rows = items.map((item) => ({ name: labels?.[item.key] ?? item.key, count: item.count }));
  const isEmpty = rows.every((row) => row.count === 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Brak rezerwacji w tym okresie</p>
        ) : (
          <ChartContainer config={config} className="h-48 w-full">
            <BarChart data={rows} layout="vertical" margin={{ right: 28 }} accessibilityLayer>
              <CartesianGrid horizontal={false} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={96} />
              <XAxis type="number" hide allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={3}>
                <LabelList dataKey="count" position="right" className="fill-foreground text-xs" />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function BreakdownCharts({ data }: { data: AnalyticsData }) {
  const { breakdown } = data;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BreakdownCard
        title="Typ parkingu"
        items={breakdown.parkingType}
        labels={PARKING_TYPE_LABELS}
        color="var(--chart-1)"
      />
      <BreakdownCard title="Źródło rezerwacji" items={breakdown.source} labels={SOURCE_LABELS} color="var(--chart-2)" />
      <BreakdownCard
        title="Klienci indywidualni vs biura"
        items={breakdown.customerType}
        labels={CUSTOMER_LABELS}
        color="var(--chart-3)"
      />
      <BreakdownCard title="Długość pobytu (doby)" items={breakdown.stayLength} color="var(--chart-4)" />
    </div>
  );
}
