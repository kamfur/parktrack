export type SonioxRegion = "eu" | "us";

export interface SonioxTemporaryKey {
  apiKey: string;
  expiresAt: string;
}

export interface SonioxTokenPort {
  /** Mints a short-lived key valid only for opening one real-time WebSocket. */
  createTemporaryKey(clientReferenceId: string): Promise<SonioxTemporaryKey>;
}

export type SonioxTokenErrorCode = "not_configured" | "upstream" | "timeout";

export class SonioxTokenError extends Error {
  constructor(
    readonly code: SonioxTokenErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "SonioxTokenError";
  }
}
