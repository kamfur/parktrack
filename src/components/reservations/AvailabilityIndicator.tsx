import type { AvailabilityIndicatorProps } from '@/types';
import { useAvailabilityCheck } from '@/hooks/useAvailabilityCheck';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

/**
 * Wskaźnik dostępności miejsc parkingowych.
 * Wyświetla liczbę wolnych miejsc lub alert o braku dostępności.
 */
export function AvailabilityIndicator({ checkInDate, checkOutDate, isChecking: externalIsChecking }: AvailabilityIndicatorProps) {
  const { availableSpots, isAvailable, isChecking: hookIsChecking, error } = useAvailabilityCheck(checkInDate, checkOutDate);
  
  const isChecking = externalIsChecking || hookIsChecking;

  if (isChecking) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
        <Skeleton className="h-5 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
        <AlertCircle className="size-5 shrink-0 text-amber-600" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-amber-900">
            Nie udało się sprawdzić dostępności
          </p>
          <p className="text-xs text-amber-700">
            Dostępność zostanie sprawdzona podczas zapisu
          </p>
        </div>
      </div>
    );
  }

  if (!checkInDate || !checkOutDate) {
    return null;
  }

  if (!isAvailable || availableSpots === 0) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3">
        <AlertCircle className="size-5 shrink-0 text-red-600" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-red-900">
            Brak wolnych miejsc
          </p>
          <p className="text-xs text-red-700">
            Nie ma wolnych miejsc w wybranych datach
          </p>
        </div>
      </div>
    );
  }

  // Determine color based on availability
  const getAvailabilityColor = (spots: number) => {
    if (spots >= 5) return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-900', subtext: 'text-green-700', icon: 'text-green-600' };
    if (spots >= 3) return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', subtext: 'text-blue-700', icon: 'text-blue-600' };
    return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', subtext: 'text-amber-700', icon: 'text-amber-600' };
  };

  const colors = getAvailabilityColor(availableSpots || 0);
  const Icon = availableSpots && availableSpots >= 5 ? CheckCircle : Info;

  return (
    <div className={`flex items-start gap-2 rounded-md border ${colors.border} ${colors.bg} p-3`}>
      <Icon className={`size-5 shrink-0 ${colors.icon}`} />
      <div className="flex flex-col gap-1">
        <p className={`text-sm font-medium ${colors.text}`}>
          {availableSpots === 1 
            ? 'Pozostało 1 wolne miejsce' 
            : `Pozostało ${availableSpots} wolnych miejsc`}
        </p>
        {availableSpots && availableSpots < 5 && (
          <p className={`text-xs ${colors.subtext}`}>
            Ograniczona dostępność w wybranych datach
          </p>
        )}
      </div>
    </div>
  );
}

