import type { APIRoute } from 'astro';
import { initializeDatabase, extractNumericValue } from '../../../config/database';

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

    // Check if bill exists
    const existingBillResult = await db.query('SELECT * FROM bills WHERE id = ?', [id]);
    if (!existingBillResult.results || existingBillResult.results.length === 0) {
      return new Response(JSON.stringify({ error: 'Bill not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build update query for bills table
    const updateFields = [];
    const params_array = [];

    // Handle all possible bill fields - comprehensive list matching database schema
    // Exclude bank fields from main list as they will be handled separately
    const billFields = [
      'invoice_date', 'challan_number', 'challan_date', 
      'po_number', 'po_date', 'dispatch_details',
      'customer_name', 'customer_code', 'customer_phone', 'customer_email', 
      'customer_address', 'customer_gst_number',
      'vendor_code', 'hsn_code',
      'subtotal', 'cgst_percentage', 'cgst_amount', 'sgst_percentage', 'sgst_amount',
      'igst_percentage', 'igst_amount', 'total_tax_amount',
      'discount_percentage', 'discount_amount', 'total_amount',
      'payment_method', 'payment_status', 'payment_terms',
      'notes', 'terms_and_conditions'
    ];

    // Handle regular bill fields
    billFields.forEach(field => {
      if (updateData.hasOwnProperty(field)) {
        updateFields.push(`${field} = ?`);
        params_array.push(updateData[field]);
      }
    });

    // Handle bank_details object if provided (priority over individual bank fields)
    if (updateData.bank_details && typeof updateData.bank_details === 'object') {
      console.log('Processing bank_details object:', updateData.bank_details);
      
      const bankDetailsFields = {
        'bank_name': updateData.bank_details.bank_name,
        'bank_account_number': updateData.bank_details.account_number,
        'bank_branch': updateData.bank_details.branch,
        'bank_ifsc_code': updateData.bank_details.ifsc_code,
        'bank_account_type': updateData.bank_details.account_type
      };

      Object.entries(bankDetailsFields).forEach(([dbField, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          updateFields.push(`${dbField} = ?`);
          params_array.push(value);
          console.log(`Added bank field ${dbField} = ${value}`);
        }
      });
    } else {
      // Handle individual bank fields if bank_details object is not provided
      const individualBankFields = [
        'bank_name', 'bank_account_number', 'bank_branch', 'bank_ifsc_code', 'bank_account_type'
      ];
      
      individualBankFields.forEach(field => {
        if (updateData.hasOwnProperty(field)) {
          updateFields.push(`${field} = ?`);
          params_array.push(updateData[field]);
          console.log(`Added individual bank field ${field} = ${updateData[field]}`);
        }
      });
    }

    // Add updated_at timestamp
    updateFields.push('updated_at = ?');
    params_array.push(new Date().toISOString());

    // Add bill ID as the last parameter for WHERE clause
    params_array.push(id);

    if (updateFields.length > 1) { // More than just updated_at
      const billQuery = `
        UPDATE bills 
        SET ${updateFields.join(', ')} 
        WHERE id = ?
      `;

      console.log('Executing bill update query:', billQuery);
      console.log('With parameters:', params_array);

      const billResult = await db.query(billQuery, params_array);
      
      if (billResult.meta && billResult.meta.changes === 0) {
        return new Response(JSON.stringify({ error: 'Bill not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Handle items update if provided
    if (updateData.items && Array.isArray(updateData.items)) {
      console.log('Processing items update. Total items received:', updateData.items.length);
      
      // Delete existing items
      await db.query('DELETE FROM bill_items WHERE bill_id = ?', [id]);

      // Insert new items - process all items from UI (up to 15)
      for (let i = 0; i < updateData.items.length; i++) {
        const item = updateData.items[i];
        console.log(`Processing item ${i + 1}:`, item);
        
        // Insert item even if some fields are empty (allows for partial data)
        // Only skip completely empty items
        const hasData = item.product_description || item.product_name || 
                       item.quantity || item.unit_price || item.total_price;
        
        if (hasData) {
          const insertResult = await db.query(`
            INSERT INTO bill_items (
              bill_id, sr_no, product_name, product_description, product_category, 
              hsn_code, unit_price, quantity, total_price, unit
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            id,
            item.sr_no || (i + 1), // Use index + 1 as fallback for sr_no
            item.product_name || item.product_description || '',
            item.product_description || '',
            item.product_category || 'General',
            item.hsn_code || '',
            parseFloat(item.unit_price) || 0,
            item.quantity || '0', // Store the full text quantity
            parseFloat(item.total_price) || (extractNumericValue(item.quantity || '0') * parseFloat(item.unit_price || '0')),
            item.unit || 'Nos'
          ]);
          console.log(`Item ${i + 1} inserted successfully`);
        } else {
          console.log(`Skipping completely empty item ${i + 1}`);
        }
      }
      
      console.log('Items update completed');
    }

    // Get the updated bill with items
    const billResult = await db.query('SELECT * FROM bills WHERE id = ?', [id]);
    const updatedBill = billResult.results?.[0];

    const itemsResult = await db.query('SELECT * FROM bill_items WHERE bill_id = ?', [id]);
    const items = itemsResult.results || [];

    const billWithItems = { ...updatedBill, items };

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Bill updated successfully',
      bill: billWithItems
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

    // Check if bill exists
    const existingBillResult = await db.query('SELECT id FROM bills WHERE id = ?', [id]);
    if (!existingBillResult.results || existingBillResult.results.length === 0) {
      return new Response(JSON.stringify({ error: 'Bill not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete bill items first (foreign key constraint)
    await db.query('DELETE FROM bill_items WHERE bill_id = ?', [id]);
    
    // Delete the bill
    await db.query('DELETE FROM bills WHERE id = ?', [id]);

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
