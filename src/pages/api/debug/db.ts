import type { APIRoute } from 'astro';
import { initializeDatabase } from '../../../config/database';

export const GET: APIRoute = async () => {
  try {
    console.log('Testing database connection...');
    
    const db = await initializeDatabase();
    console.log('Database client initialized successfully');
    
    // Test a simple query
    const result = await db.query('SELECT 1 as test');
    console.log('Test query result:', result);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Database connection successful',
      testResult: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Database test error:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
