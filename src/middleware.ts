import { defineMiddleware } from "astro:middleware";
import {
  adminSessionCookie,
  AuthConfigurationError,
  isValidSessionToken,
} from "./lib/auth/session";
import { createRequestLogger } from "./lib/server/logging";

const protectedPagePrefixes = ["/bills", "/invoice"];
const protectedApiPrefixes = ["/api/bills", "/api/customers", "/api/debug"];

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;
  const isProtectedPage = protectedPagePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isProtectedApi = protectedApiPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtectedPage && !isProtectedApi) {
    return next();
  }

  const log = createRequestLogger("middleware.auth", context.request);
  const token = context.cookies.get(adminSessionCookie.name)?.value;
  let authenticated = false;

  try {
    authenticated = await isValidSessionToken(token);
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) {
      log.error("authentication.failed", error);
      throw error;
    }

    log.error("authentication.configuration_missing", error, {
      status: 503,
    });
    return new Response(
      "Admin login is not configured. Set ADMIN_PIN and SESSION_SECRET.",
      { status: 503 },
    );
  }

  if (authenticated) {
    log.info("authentication.succeeded", {
      requestType: isProtectedApi ? "api" : "page",
    });
    const response = await next();
    log.info("request.completed", {
      status: response.status,
      durationMs: log.elapsedMs(),
    });
    return response;
  }

  log.warn("authentication.rejected", {
    requestType: isProtectedApi ? "api" : "page",
    tokenPresent: Boolean(token),
  });
  context.cookies.delete(adminSessionCookie.name, { path: "/" });

  if (isProtectedApi) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return context.redirect("/login");
});
