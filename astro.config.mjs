// @ts-check
import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  env: {
    schema: {
      ADMIN_PIN: envField.string({
        context: 'server',
        access: 'secret',
        optional: true
      }),
      SESSION_SECRET: envField.string({
        context: 'server',
        access: 'secret',
        optional: true
      }),
      CLOUDFLARE_ACCOUNT_ID: envField.string({
        context: 'server',
        access: 'secret',
        optional: true
      }),
      CLOUDFLARE_D1_DATABASE_ID: envField.string({
        context: 'server',
        access: 'secret',
        optional: true
      }),
      CLOUDFLARE_API_TOKEN: envField.string({
        context: 'server',
        access: 'secret',
        optional: true
      })
    }
  },
  adapter: cloudflare({
    platformProxy: {
      enabled: true
    }
  }),
});
