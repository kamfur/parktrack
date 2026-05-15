import React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

/**
 * Loading skeleton dla widoku szczegółów rezerwacji.
 * Wyświetla placeholder podczas ładowania danych.
 */
export function LoadingSkeleton() {
  return (
    <div className="space-y-6 px-6 py-4 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-3">
        <div className="h-8 bg-muted rounded w-48"></div>
        <div className="h-4 bg-muted rounded w-24"></div>
      </div>

      {/* Personal Info Card Skeleton */}
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-32"></div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-48"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-32"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-24"></div>
          </div>
        </CardContent>
      </Card>

      {/* Reservation Details Card Skeleton */}
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-40"></div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-muted rounded"></div>
            <div>
              <div className="h-3 bg-muted rounded w-16 mb-2"></div>
              <div className="h-4 bg-muted rounded w-56"></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-muted rounded"></div>
            <div>
              <div className="h-3 bg-muted rounded w-16 mb-2"></div>
              <div className="h-4 bg-muted rounded w-56"></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Section Skeleton */}
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-24"></div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-10 bg-muted rounded w-32"></div>
          <div className="flex gap-3">
            <div className="h-16 bg-muted rounded w-32"></div>
            <div className="h-16 bg-muted rounded w-32"></div>
          </div>
        </CardContent>
      </Card>

      {/* Notes Section Skeleton */}
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-24"></div>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted rounded"></div>
        </CardContent>
      </Card>
    </div>
  );
}

