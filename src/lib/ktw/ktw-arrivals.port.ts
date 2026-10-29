import type { KtwBoardRow } from "./select-arrival-hours";

export interface KtwArrivalsPort {
  listArrivals(now: Date): Promise<KtwBoardRow[]>;
}

export class KtwArrivalsError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "KtwArrivalsError";
  }
}
