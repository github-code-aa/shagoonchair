import type { APIRoute } from "astro";
import {
  adminSessionCookie,
  AuthConfigurationError,
  isValidSessionToken,
} from "../../../lib/auth/session";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const token = cookies.get(adminSessionCookie.name)?.value;
    const authenticated = await isValidSessionToken(token);

    return new Response(JSON.stringify({ authenticated }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const configurationError = error instanceof AuthConfigurationError;
    return new Response(JSON.stringify({
      authenticated: false,
      error: configurationError
        ? "Admin login is not configured. Set ADMIN_PIN and SESSION_SECRET."
        : "Unable to verify session",
    }), {
      status: configurationError ? 503 : 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
