import type { APIRoute } from 'astro';
import type { Bill } from '../../../config/database';
import { initializeDatabase, type D1DatabaseClient } from '../../../config/database';

// This endpoint handles all bill-related operations using Cloudflare D1 REST API
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    
    // Initialize D1 database client
    const db = initializeDatabase();
    
    switch (action) {
      case 'list':
        return await getAllBills(db, url.searchParams);
      
      case 'get':
        const billNumber = url.searchParams.get('billNumber');
        if (!billNumber) {
          return new Response(JSON.stringify({ error: 'Bill number required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await getBill(db, billNumber);
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const billData: Bill = await request.json();
    
    // Initialize D1 database client
    const db = initializeDatabase();

    return await createBill(db, billData);
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const billData: Bill = await request.json();
    
    const db = initializeDatabase();

    return await updateBill(db, billData);
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const billNumber = url.searchParams.get('billNumber');
    
    if (!billNumber) {
      return new Response(JSON.stringify({ error: 'Bill number required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const db = initializeDatabase();

    return await deleteBill(db, billNumber);
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Database operation functions using D1 REST API
async function getAllBills(db: D1DatabaseClient, searchParams: URLSearchParams) {
  try {
    let query = `
      SELECT 
        b.*
      FROM bills b
    `;
    
    const conditions = [];
    const params: any[] = [];
    
    // Apply filters
    const search = searchParams.get('search');
    if (search) {
      conditions.push('(b.customer_name LIKE ? OR b.bill_number LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    const status = searchParams.get('status');
    if (status) {
      conditions.push('b.payment_status = ?');
      params.push(status);
    }
    
    const payment = searchParams.get('payment');
    if (payment) {
      conditions.push('b.payment_method = ?');
      params.push(payment);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY b.created_at DESC';
    
    // Add pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await db.query(query, params);
    const bills = result.results || [];
    
    // Get items for each bill
    const billsWithItems = await Promise.all(bills.map(async (bill: any) => {
      const itemsResult = await db.query('SELECT * FROM bill_items WHERE bill_id = ?', [bill.id]);
      const items = itemsResult.results || [];
      return { ...bill, items };
    }));
    
    return new Response(JSON.stringify({ bills: billsWithItems, page, limit }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Database error:', error);
    return new Response(JSON.stringify({ error: 'Database query failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function getBill(db: D1DatabaseClient, billNumber: string) {
  try {
    // Get bill details
    const billResult = await db.query('SELECT * FROM bills WHERE bill_number = ?', [billNumber]);
    const bill = billResult.results?.[0];
    
    if (!bill) {
      return new Response(JSON.stringify({ error: 'Bill not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get bill items
    const itemsResult = await db.query('SELECT * FROM bill_items WHERE bill_id = ?', [bill.id]);
    const items = itemsResult.results || [];
    
    const billWithItems = { ...bill, items };
    
    return new Response(JSON.stringify({ bill: billWithItems }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Database error:', error);
    return new Response(JSON.stringify({ error: 'Database query failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function createBill(db: D1DatabaseClient, billData: Bill) {
  try {
    // Insert bill
    const billResult = await db.query(`
      INSERT INTO bills (
        bill_number, customer_name, customer_phone, customer_email, customer_address,
        subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount,
        total_amount, payment_method, payment_status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [
      billData.bill_number,
      billData.customer_name,
      billData.customer_phone,
      billData.customer_email || null,
      billData.customer_address || null,
      billData.subtotal,
      billData.tax_percentage,
      billData.tax_amount,
      billData.discount_percentage || 0,
      billData.discount_amount || 0,
      billData.total_amount,
      billData.payment_method,
      billData.payment_status,
      billData.notes || null,
      billData.created_at,
      billData.updated_at
    ]);
    
    const billId = billResult.results?.[0]?.id || billResult.meta?.last_row_id;
    
    if (!billId) {
      throw new Error('Failed to get bill ID after insertion');
    }
    
    // Insert bill items using batch
    if (billData.items.length > 0) {
      const itemStatements = billData.items.map(item => ({
        sql: `INSERT INTO bill_items (
          bill_id, product_name, product_category, quantity, unit_price, total_price, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [
          billId,
          item.product_name,
          item.product_category,
          item.quantity,
          item.unit_price,
          item.total_price,
          item.description || null
        ]
      }));
      
      await db.batch(itemStatements);
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      billNumber: billData.bill_number,
      billId 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Database error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create bill' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function updateBill(db: D1DatabaseClient, billData: Bill) {
  try {
    // Update bill
    await db.query(`
      UPDATE bills SET 
        customer_name = ?, customer_phone = ?, customer_email = ?, customer_address = ?,
        subtotal = ?, tax_percentage = ?, tax_amount = ?, discount_percentage = ?, discount_amount = ?,
        total_amount = ?, payment_method = ?, payment_status = ?, notes = ?, updated_at = ?
      WHERE bill_number = ?
    `, [
      billData.customer_name,
      billData.customer_phone,
      billData.customer_email || null,
      billData.customer_address || null,
      billData.subtotal,
      billData.tax_percentage,
      billData.tax_amount,
      billData.discount_percentage || 0,
      billData.discount_amount || 0,
      billData.total_amount,
      billData.payment_method,
      billData.payment_status,
      billData.notes || null,
      new Date().toISOString(),
      billData.bill_number
    ]);
    
    return new Response(JSON.stringify({ 
      success: true, 
      billNumber: billData.bill_number 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Database error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update bill' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function deleteBill(db: D1DatabaseClient, billNumber: string) {
  try {
    // Get bill ID first
    const billResult = await db.query('SELECT id FROM bills WHERE bill_number = ?', [billNumber]);
    const bill = billResult.results?.[0];
    
    if (!bill) {
      return new Response(JSON.stringify({ error: 'Bill not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Delete bill and items using batch (foreign key cascade should handle items)
    const deleteStatements = [
      {
        sql: 'DELETE FROM bill_items WHERE bill_id = ?',
        params: [bill.id]
      },
      {
        sql: 'DELETE FROM bills WHERE bill_number = ?',
        params: [billNumber]
      }
    ];
    
    await db.batch(deleteStatements);
    
    return new Response(JSON.stringify({ 
      success: true, 
      billNumber 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Database error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete bill' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
