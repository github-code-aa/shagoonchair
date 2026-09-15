export type LogDetails = Record<string, unknown>;

function serializeError(error: unknown): LogDetails {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };
  }

  return {
    errorType: typeof error,
    errorMessage: String(error),
  };
}

function writeLog(
  level: "info" | "warn" | "error",
  scope: string,
  event: string,
  details: LogDetails,
): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    scope,
    event,
    ...details,
  });

  if (level === "error") {
    console.error(entry);
  } else if (level === "warn") {
    console.warn(entry);
  } else {
    console.log(entry);
  }
}

export function createRequestLogger(scope: string, request: Request) {
  const requestId =
    request.headers.get("cf-ray") ||
    request.headers.get("x-request-id") ||
    crypto.randomUUID();
  const startedAt = Date.now();
  const url = new URL(request.url);

  const baseDetails = {
    requestId,
    method: request.method,
    path: url.pathname,
  };

  return {
    requestId,
    elapsedMs: () => Date.now() - startedAt,
    info(event: string, details: LogDetails = {}) {
      writeLog("info", scope, event, { ...baseDetails, ...details });
    },
    warn(event: string, details: LogDetails = {}) {
      writeLog("warn", scope, event, { ...baseDetails, ...details });
    },
    error(event: string, error: unknown, details: LogDetails = {}) {
      writeLog("error", scope, event, {
        ...baseDetails,
        ...details,
        ...serializeError(error),
      });
    },
  };
}

export function logServerInfo(
  scope: string,
  event: string,
  details: LogDetails = {},
): void {
  writeLog("info", scope, event, details);
}

export function logServerError(
  scope: string,
  event: string,
  error: unknown,
  details: LogDetails = {},
): void {
  writeLog("error", scope, event, {
    ...details,
    ...serializeError(error),
  });
}

export function addRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Request-ID", requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
