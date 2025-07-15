import type { APIRoute } from 'astro';
import { initializeDatabase } from '../../../config/database';

export const prerender = false;

export const PUT: APIRoute = async ({ request, params }) => {
  try {
    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Bill ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updateData = await request.json();
    console.log('Updating bill ID:', id, 'with data:', updateData);

    // Initialize database
    const db = await initializeDatabase();

    // Build update query based on provided fields
    const updateFields = [];
    const params_array = [];

    if (updateData.payment_status) {
      updateFields.push('payment_status = ?');
      params_array.push(updateData.payment_status);
    }

    if (updateData.payment_method) {
      updateFields.push('payment_method = ?');
      params_array.push(updateData.payment_method);
    }

    if (updateFields.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add updated_at timestamp
    updateFields.push('updated_at = ?');
    params_array.push(new Date().toISOString());

    // Add bill ID as the last parameter for WHERE clause
    params_array.push(id);

    const query = `
      UPDATE bills 
      SET ${updateFields.join(', ')} 
      WHERE id = ?
    `;

    console.log('Executing query:', query);
    console.log('With parameters:', params_array);

    const result = await db.query(query, params_array);
    
    if (result.meta && result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Bill not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the updated bill
    const billResult = await db.query('SELECT * FROM bills WHERE id = ?', [id]);
    const updatedBill = billResult.results?.[0];

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Bill updated successfully',
      bill: updatedBill
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating bill:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to update bill',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Bill ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Initialize database
    const db = await initializeDatabase();

    // Get bill details
    const billResult = await db.query('SELECT * FROM bills WHERE id = ?', [id]);
    const bill = billResult.results?.[0];

    if (!bill) {
      return new Response(JSON.stringify({ error: 'Bill not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get bill items
    const itemsResult = await db.query('SELECT * FROM bill_items WHERE bill_id = ?', [id]);
    const items = itemsResult.results || [];

    const billWithItems = { ...bill, items };

    return new Response(JSON.stringify({ bill: billWithItems }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching bill:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch bill',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const id = params.id;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Bill ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Initialize database
    const db = await initializeDatabase();

    // First, delete all bill items
    await db.query('DELETE FROM bill_items WHERE bill_id = ?', [id]);

    // Then delete the bill
    const result = await db.query('DELETE FROM bills WHERE id = ?', [id]);

    if (result.meta && result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Bill not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Bill deleted successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting bill:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete bill',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
