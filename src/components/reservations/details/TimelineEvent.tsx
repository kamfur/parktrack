import React from "react";
import { Plus, Edit, LogIn, LogOut, XCircle, RefreshCw } from "lucide-react";
import type { TimelineEventProps } from "@/types";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

/**
 * Pojedynczy event w timeline historii rezerwacji.
 */
export function TimelineEventComponent({ event }: TimelineEventProps) {
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return format(date, "d MMMM yyyy, HH:mm", { locale: pl });
    } catch {
      return timestamp;
    }
  };

  const getEventIcon = () => {
    const iconProps = { className: "h-4 w-4" };

    switch (event.type) {
      case "created":
        return <Plus {...iconProps} />;
      case "updated":
        return <Edit {...iconProps} />;
      case "check_in":
        return <LogIn {...iconProps} />;
      case "check_out":
        return <LogOut {...iconProps} />;
      case "cancelled":
        return <XCircle {...iconProps} />;
      case "status_changed":
        return <RefreshCw {...iconProps} />;
      default:
        return <Edit {...iconProps} />;
    }
  };

  const getEventColor = () => {
    switch (event.type) {
      case "created":
        return "bg-blue-500";
      case "updated":
        return "bg-orange-500";
      case "check_in":
        return "bg-green-500";
      case "check_out":
        return "bg-gray-500";
      case "cancelled":
        return "bg-red-500";
      case "status_changed":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const getEventTitle = () => {
    const titles: Record<string, string> = {
      created: "Rezerwacja utworzona",
      updated: "Rezerwacja zaktualizowana",
      check_in: "Check-in wykonany",
      check_out: "Check-out wykonany",
      cancelled: "Rezerwacja anulowana",
      status_changed: "Status zmieniony",
    };
    return titles[event.type] || "Zdarzenie";
  };

  return (
    <div className="flex gap-3">
      {/* Icon Circle */}
      <div className="flex flex-col items-center">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${getEventColor()} text-white`}>
          {getEventIcon()}
        </div>
        {/* Vertical line - can be hidden for last item */}
        <div className="w-0.5 flex-1 bg-border mt-2" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="mb-1">
          <p className="font-medium">{getEventTitle()}</p>
          <p className="text-sm text-muted-foreground">{formatTimestamp(event.timestamp)}</p>
        </div>

        {event.performedBy && <p className="text-sm text-muted-foreground">Wykonane przez: {event.performedBy}</p>}

        {event.details && <p className="text-sm text-muted-foreground mt-1">{event.details}</p>}

        {event.changes && Object.keys(event.changes).length > 0 && (
          <div className="mt-2 text-sm">
            <p className="font-medium text-muted-foreground mb-1">Zmiany:</p>
            <ul className="space-y-1">
              {Object.entries(event.changes).map(([field, change]) => (
                <li key={field} className="text-muted-foreground">
                  <span className="font-medium">{field}:</span>{" "}
                  <span className="line-through">{String(change.old)}</span>
                  {" → "}
                  <span className="text-foreground">{String(change.new)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
