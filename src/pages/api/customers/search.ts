import type { APIRoute } from 'astro';
import { initializeDatabase } from '../../../config/database';

export const prerender = false;

/**
 * API endpoint to search for distinct customer profiles from the bills table.
 * It returns the customer details from the most recent bill for each unique customer name.
 *
 * @example
 * GET /api/customers/search?q=corp
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (!query || query.trim().length < 3) {
      return new Response(JSON.stringify({ 
        error: 'A search query of at least 3 characters is required.' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = await initializeDatabase();
    const searchTerm = `%${query}%`;

    // This query is designed to find unique customers based on their name.
    // It first finds the highest `id` (most recent bill) for each customer name
    // that matches the search term, and then joins back to the `bills` table
    // to retrieve the full details for that specific, most recent bill.
    const searchQuery = `
      SELECT
        b.customer_name,
        b.customer_code,
        b.customer_phone,
        b.customer_email,
        b.customer_address,
        b.customer_gst_number
      FROM
        bills b
      INNER JOIN (
        SELECT
          customer_name,
          MAX(id) AS max_id
        FROM
          bills
        WHERE
          customer_name LIKE ?
        GROUP BY
          customer_name
      ) AS recent_bills ON b.id = recent_bills.max_id
      ORDER BY
        b.customer_name ASC
      LIMIT 10;
    `;

    const result = await db.query(searchQuery, [searchTerm]);
    const customers = result.results || [];

    return new Response(JSON.stringify(customers), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error searching for customers:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to search for customers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};