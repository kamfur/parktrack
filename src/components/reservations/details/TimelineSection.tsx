import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { TimelineSectionProps } from "@/types";
import { TimelineEventComponent } from "./TimelineEvent";

/**
 * Sekcja wyświetlająca historię zmian rezerwacji w formie pionowego timeline.
 */
export function TimelineSection({ events, isCollapsed = false }: TimelineSectionProps) {
  const [collapsed, setCollapsed] = useState(isCollapsed);

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Brak historii zmian</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={toggleCollapse}>
        <div className="flex items-center justify-between">
          <CardTitle>Historia</CardTitle>
          <button className="p-1 rounded hover:bg-muted transition-colors" aria-label={collapsed ? "Rozwiń" : "Zwiń"}>
            {collapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </button>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent>
          <div className="space-y-4">
            {events.map((event, index) => (
              <TimelineEventComponent key={index} event={event} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
