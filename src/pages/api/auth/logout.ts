import type { APIRoute } from "astro";
import { adminSessionCookie } from "../../../lib/auth/session";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete(adminSessionCookie.name, { path: "/" });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
