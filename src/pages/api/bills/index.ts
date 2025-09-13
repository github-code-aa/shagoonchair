import type { APIRoute } from 'astro';
import type { Bill } from '../../../config/database';
import { initializeDatabase, extractNumericValue, type D1DatabaseClient } from '../../../config/database';

export const prerender = false;

// This endpoint handles all bill-related operations using Cloudflare D1 REST API
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'list'; // Default to 'list'
    
    // Initialize D1 database client
    const db = await initializeDatabase();
    
    switch (action) {
      case 'list':
        return await getAllBills(db, url.searchParams);
      
      case 'get':
        const billId = url.searchParams.get('billId');
        if (!billId) {
          return new Response(JSON.stringify({ error: 'Bill ID required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return await getBill(db, billId);
      
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
  console.log('🔍 POST /api/bills - Starting request processing');
  
  try {
    // Log request details
    console.log('📥 Request method:', request.method);
    console.log('📥 Request URL:', request.url);
    console.log('📥 Request headers:', Object.fromEntries(request.headers.entries()));
    
    // Check if request has body
    const contentType = request.headers.get('content-type');
    const contentLength = request.headers.get('content-length');
    console.log('📥 Content-Type:', contentType);
    console.log('📥 Content-Length:', contentLength);
    
    if (!contentType || !contentType.includes('application/json')) {
      console.error('❌ Invalid content type. Expected application/json, got:', contentType);
      return new Response(JSON.stringify({ 
        error: 'Invalid content type. Expected application/json' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if body is empty
    if (contentLength === '0' || contentLength === null) {
      console.error('❌ Empty request body');
      return new Response(JSON.stringify({ 
        error: 'Request body is empty' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get raw body text first to debug
    let rawBody: string;
    try {
      rawBody = await request.text();
      console.log('📋 Raw body length:', rawBody.length);
      console.log('📋 Raw body preview:', rawBody.substring(0, 200) + (rawBody.length > 200 ? '...' : ''));
      
      if (!rawBody || rawBody.trim() === '') {
        console.error('❌ Empty body text');
        return new Response(JSON.stringify({ 
          error: 'Request body is empty' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (textError) {
      console.error('❌ Failed to read request body as text:', textError);
      return new Response(JSON.stringify({ 
        error: 'Failed to read request body',
        details: textError instanceof Error ? textError.message : 'Unknown error'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse JSON from raw body
    let billData: Bill;
    try {
      billData = JSON.parse(rawBody);
      console.log('✅ Successfully parsed JSON data');
      console.log('📋 Received bill data keys:', Object.keys(billData));
      console.log('📋 Customer name:', billData.customer_name);
      console.log('📋 Customer name:', billData.customer_name);
      console.log('📋 Items count:', billData.items?.length || 0);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON:', parseError);
      console.error('❌ Raw body that failed to parse:', rawBody);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON format in request body',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
        rawBodyPreview: rawBody.substring(0, 100)
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate required fields
    console.log('🔍 Validating required fields...');
    const requiredFields = ['customer_name', 'customer_phone', 'invoice_date'];
    const missingFields = requiredFields.filter(field => !billData[field as keyof Bill]);
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields);
      return new Response(JSON.stringify({ 
        error: 'Missing required fields',
        missingFields 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate items
    if (!billData.items || billData.items.length === 0) {
      console.error('❌ No items provided');
      return new Response(JSON.stringify({ 
        error: 'At least one item is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log('✅ Validation passed');
    
    // Initialize database
    console.log('🗄️ Initializing database connection...');
    
    try {
      const db = await initializeDatabase();
      console.log('✅ Database connection established');
      
      // Call createBill function
      console.log('💾 Creating bill in database...');
      const result = await createBill(db, billData);
      console.log('✅ Bill creation completed');
      
      return result;
      
    } catch (dbError) {
      console.error('❌ Database initialization or operation failed:', dbError);
      
      if (dbError instanceof Error) {
        console.error('❌ DB Error message:', dbError.message);
        console.error('❌ DB Error stack:', dbError.stack);
      }
      
      return new Response(JSON.stringify({ 
        error: 'Database operation failed',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error in POST handler:', error);
    
    // Log more details about the error
    if (error instanceof Error) {
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
    }
    
    // Log error type and properties
    console.error('❌ Error type:', typeof error);
    console.error('❌ Error constructor:', error?.constructor?.name);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      type: error?.constructor?.name || typeof error
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const billData: Bill = await request.json();
    
    const db = await initializeDatabase();

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
    const billId = url.searchParams.get('billId');
    
    if (!billId) {
      return new Response(JSON.stringify({ error: 'Bill ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const db = await initializeDatabase();

    return await deleteBill(db, billId);
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
    
    let countQuery = `
      SELECT COUNT(*) as total
      FROM bills b
    `;
    
    const conditions = [];
    const params: any[] = [];
    
    // Apply filters
    const search = searchParams.get('search');
    if (search) {
      conditions.push('(b.customer_name LIKE ? OR CAST(b.id AS TEXT) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    // Date range filtering
    const startDate = searchParams.get('startDate');
    if (startDate) {
      conditions.push('DATE(b.invoice_date) >= ?');
      params.push(startDate);
    }
    
    const endDate = searchParams.get('endDate');
    if (endDate) {
      conditions.push('DATE(b.invoice_date) <= ?');
      params.push(endDate);
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
    
    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
    query += whereClause;
    countQuery += whereClause;
    
    query += ' ORDER BY b.created_at DESC';
    
    // Add pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    // Get total count for pagination
    const countResult = await db.query(countQuery, params);
    const total = countResult.results?.[0]?.total || 0;
    
    const result = await db.query(query, params);
    const bills = result.results || [];
    
    // Get items for each bill
    const billsWithItems = await Promise.all(bills.map(async (bill: any) => {
      const itemsResult = await db.query('SELECT * FROM bill_items WHERE bill_id = ?', [bill.id]);
      const items = itemsResult.results || [];
      return { ...bill, items };
    }));
    
    return new Response(JSON.stringify({ 
      bills: billsWithItems, 
      page, 
      limit, 
      total: parseInt(total.toString())
    }), {
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

async function getBill(db: D1DatabaseClient, billId: string) {
  try {
    // Get bill details
    const billResult = await db.query('SELECT * FROM bills WHERE id = ?', [billId]);
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
  let billId: number | null = null;
  
  try {
    // Execute bill insertion first to get the bill ID
    console.log('💾 Inserting bill record...');
    const billResult = await db.query(`
      INSERT INTO bills (
        bill_number, invoice_date, challan_number, challan_date, po_number, po_date, dispatch_details,
        customer_name, customer_code, customer_phone, customer_email, customer_address,
        customer_gst_number, vendor_code, hsn_code, subtotal,
        cgst_percentage, cgst_amount, sgst_percentage, sgst_amount, igst_percentage, igst_amount, total_tax_amount,
        discount_percentage, discount_amount, total_amount, payment_method, payment_status, payment_terms,
        bank_name, bank_account_number, bank_branch, bank_ifsc_code, bank_account_type, notes,
        terms_and_conditions, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [
      billData.bill_number || null,
      billData.invoice_date,
      billData.challan_number || null,
      billData.challan_date || null,
      billData.po_number || null,
      billData.po_date || null,
      billData.dispatch_details || null,
      billData.customer_name,
      billData.customer_code || null,
      billData.customer_phone,
      billData.customer_email || null,
      billData.customer_address || null,
      billData.customer_gst_number || null,
      billData.vendor_code || null,
      billData.hsn_code || null,
      billData.subtotal,
      billData.cgst_percentage,
      billData.cgst_amount,
      billData.sgst_percentage,
      billData.sgst_amount,
      billData.igst_percentage,
      billData.igst_amount,
      billData.total_tax_amount,
      billData.discount_percentage || 0,
      billData.discount_amount || 0,
      billData.total_amount,
      billData.payment_method,
      billData.payment_status,
      billData.payment_terms || null,
      billData.bank_details?.bank_name || null,
      billData.bank_details?.account_number || null,
      billData.bank_details?.branch || null,
      billData.bank_details?.ifsc_code || null,
      billData.bank_details?.account_type || null,
      billData.notes || null,
      billData.terms_and_conditions || null,
      billData.created_at,
      billData.updated_at
    ]);
    
    billId = billResult.results?.[0]?.id || billResult.meta?.last_row_id;
    
    if (!billId) {
      throw new Error('Failed to get bill ID after insertion');
    }
    
    console.log('✅ Bill inserted with ID:', billId);
    
    // Prepare and insert items sequentially
    if (billData.items && billData.items.length > 0) {
      console.log('💾 Preparing to insert', billData.items.length, 'items...');
      
      try {
        const itemStatements = [];
        
        for (let index = 0; index < billData.items.length; index++) {
          const item = billData.items[index];
          
          // Ensure all required fields are present and properly typed
          const unitPrice = parseFloat(item.unit_price?.toString() || '0');
          const quantityText = item.quantity?.toString() || '1'; // Store the full text
          const quantityNumeric = extractNumericValue(quantityText); // Extract numeric for validation
          const totalPrice = parseFloat(item.total_price?.toString() || '0');
          const srNo = parseInt(item.sr_no?.toString() || (index + 1).toString());
          
          console.log(`📦 Item ${index + 1}:`, {
            sr_no: srNo,
            product_name: item.product_name,
            product_description: item.product_description,
            product_category: item.product_category,
            quantity: quantityText,
            quantity_numeric: quantityNumeric,
            unit_price: unitPrice,
            total_price: totalPrice,
            unit: item.unit || 'Nos'
          });
          
          // Validate required fields
          if (!item.product_name || item.product_name.trim() === '') {
            throw new Error(`Item ${index + 1}: Product name is required`);
          }
          if (!item.product_category || item.product_category.trim() === '') {
            throw new Error(`Item ${index + 1}: Product category is required`);
          }
          if (unitPrice <= 0) {
            throw new Error(`Item ${index + 1}: Unit price must be greater than 0`);
          }
          if (quantityNumeric <= 0) {
            throw new Error(`Item ${index + 1}: Quantity must be greater than 0`);
          }
          if (totalPrice <= 0) {
            throw new Error(`Item ${index + 1}: Total price must be greater than 0`);
          }
          
          itemStatements.push({
            sql: `INSERT INTO bill_items (
              bill_id, sr_no, product_name, product_description, product_category, hsn_code,
              unit_price, quantity, total_price, unit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params: [
              billId,
              srNo,
              item.product_name.trim(),
              item.product_description?.trim() || null,
              item.product_category.trim(),
              item.hsn_code?.trim() || null,
              unitPrice,
              quantityText,
              totalPrice,
              item.unit?.trim() || 'Nos'
            ]
          });
        }
        
        // Execute item insertions using batch
        console.log('💾 Inserting bill items using batch...');
        const batchResult = await db.batch(itemStatements);
        console.log('✅ Batch result:', batchResult);
        console.log('✅ All bill items inserted successfully');
        
      } catch (itemError) {
        console.error('❌ Failed to insert items, rolling back bill:', itemError);
        
        // Rollback: Delete the bill if item insertion fails
        try {
          await db.query('DELETE FROM bills WHERE id = ?', [billId]);
          console.log('✅ Bill rolled back successfully');
        } catch (rollbackError) {
          console.error('❌ Failed to rollback bill:', rollbackError);
        }
        
        throw itemError;
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      billId,
      itemsCount: billData.items?.length || 0
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Database error:', error);
    
    // Handle specific constraint errors
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return new Response(JSON.stringify({ 
        error: 'Constraint failed',
        message: 'A database constraint was violated.'
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : 'No stack trace available'
    }), {
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
        bill_number = ?, invoice_date = ?, customer_name = ?, customer_phone = ?, customer_email = ?, customer_address = ?,
        customer_gst_number = ?, vendor_code = ?, hsn_code = ?, subtotal = ?,
        cgst_percentage = ?, cgst_amount = ?, sgst_percentage = ?, sgst_amount = ?,
        igst_percentage = ?, igst_amount = ?, total_tax_amount = ?,
        discount_percentage = ?, discount_amount = ?, total_amount = ?,
        payment_method = ?, payment_status = ?, payment_terms = ?,
        bank_name = ?, bank_account_number = ?, bank_branch = ?, bank_ifsc_code = ?, bank_account_type = ?,
        notes = ?, updated_at = ?
      WHERE id = ?
    `, [
      billData.bill_number || null,
      billData.invoice_date,
      billData.customer_name,
      billData.customer_phone,
      billData.customer_email || null,
      billData.customer_address || null,
      billData.customer_gst_number || null,
      billData.vendor_code || null,
      billData.hsn_code || null,
      billData.subtotal,
      billData.cgst_percentage,
      billData.cgst_amount,
      billData.sgst_percentage,
      billData.sgst_amount,
      billData.igst_percentage,
      billData.igst_amount,
      billData.total_tax_amount,
      billData.discount_percentage || 0,
      billData.discount_amount || 0,
      billData.total_amount,
      billData.payment_method,
      billData.payment_status,
      billData.payment_terms || null,
      billData.bank_details?.bank_name || null,
      billData.bank_details?.account_number || null,
      billData.bank_details?.branch || null,
      billData.bank_details?.ifsc_code || null,
      billData.bank_details?.account_type || null,
      billData.notes || null,
      new Date().toISOString(),
      billData.id
    ]);
    
    return new Response(JSON.stringify({ 
      success: true, 
      billId: billData.id 
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

async function deleteBill(db: D1DatabaseClient, billId: string) {
  try {
    // Check if bill exists
    const billResult = await db.query('SELECT id FROM bills WHERE id = ?', [billId]);
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
        params: [billId]
      },
      {
        sql: 'DELETE FROM bills WHERE id = ?',
        params: [billId]
      }
    ];
    
    await db.batch(deleteStatements);
    
    return new Response(JSON.stringify({ 
      success: true, 
      billId 
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
