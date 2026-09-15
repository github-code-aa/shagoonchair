import {
  ADMIN_PIN,
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_D1_DATABASE_ID,
  SESSION_SECRET,
} from "astro:env/server";

export type ServerSecretName =
  | "ADMIN_PIN"
  | "SESSION_SECRET"
  | "CLOUDFLARE_ACCOUNT_ID"
  | "CLOUDFLARE_D1_DATABASE_ID"
  | "CLOUDFLARE_API_TOKEN";

const serverValues: Record<ServerSecretName, string | undefined> = {
  ADMIN_PIN,
  SESSION_SECRET,
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_D1_DATABASE_ID,
  CLOUDFLARE_API_TOKEN,
};

export function getServerSecret(name: ServerSecretName): string {
  const value = serverValues[name];

  if (!value) {
    throw new Error(`Missing required server environment variable: ${name}`);
  }

  return value;
}
