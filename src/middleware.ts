import { defineMiddleware } from "astro:middleware";
import {
  adminSessionCookie,
  AuthConfigurationError,
  isValidSessionToken,
} from "./lib/auth/session";

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

  const token = context.cookies.get(adminSessionCookie.name)?.value;
  let authenticated = false;

  try {
    authenticated = await isValidSessionToken(token, context.locals);
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) {
      throw error;
    }

    return new Response(
      "Admin login is not configured. Set ADMIN_PIN and SESSION_SECRET.",
      { status: 503 },
    );
  }

  if (authenticated) {
    return next();
  }

  context.cookies.delete(adminSessionCookie.name, { path: "/" });

  if (isProtectedApi) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return context.redirect("/login");
});
