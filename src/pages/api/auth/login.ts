import type { APIRoute } from "astro";
import {
  adminSessionCookie,
  AuthConfigurationError,
  createSessionToken,
  verifyAdminPin,
} from "../../../lib/auth/session";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const body = await request.json();
    const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

    if (!/^\d{6}$/.test(pin) || !(await verifyAdminPin(pin, locals))) {
      return new Response(JSON.stringify({ error: "Invalid PIN" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = await createSessionToken(locals);
    cookies.set(adminSessionCookie.name, token, {
      ...adminSessionCookie.options,
      maxAge: adminSessionCookie.maxAge,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin login failed:", error);
    const configurationError = error instanceof AuthConfigurationError;
    return new Response(JSON.stringify({
      error: configurationError
        ? "Admin login is not configured. Set ADMIN_PIN and SESSION_SECRET."
        : "Unable to authenticate",
    }), {
      status: configurationError ? 503 : 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
