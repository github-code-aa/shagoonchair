import type { APIRoute } from 'astro';
import { initializeDatabase } from '../../../config/database';
import {
  addRequestId,
  createRequestLogger,
} from '../../../lib/server/logging';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const log = createRequestLogger('api.debug.database', request);
  log.info('request.started');

  try {
    const db = await initializeDatabase();
    const result = await db.query('SELECT 1 as test');

    log.info('request.completed', {
      status: 200,
      durationMs: log.elapsedMs(),
    });
    return addRequestId(
      new Response(JSON.stringify({
        success: true,
        message: 'Database connection successful',
        testResult: result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }),
      log.requestId,
    );
  } catch (error) {
    log.error('request.failed', error, {
      status: 500,
      durationMs: log.elapsedMs(),
    });
    return addRequestId(
      new Response(JSON.stringify({
        success: false,
        error: 'Database connection failed',
        requestId: log.requestId,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }),
      log.requestId,
    );
  }
};
