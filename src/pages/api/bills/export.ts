import type { APIRoute } from 'astro';
import * as xlsx from 'xlsx';
import { initializeDatabase, type D1DatabaseClient } from '../../../config/database';

export const prerender = false;

// Export endpoint for downloading bills as Excel
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    
    // Initialize D1 database client
    const db = await initializeDatabase();
    
    return await exportBillsToExcel(db, url.searchParams);
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Export failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function exportBillsToExcel(db: D1DatabaseClient, searchParams: URLSearchParams) {
  try {
    // Build query to fetch ALL matching records (no pagination)
    let query = `
      SELECT 
        b.bill_number,
        b.customer_name,
        b.invoice_date,
        b.subtotal,
        b.cgst_amount,
        b.sgst_amount,
        b.igst_amount,
        b.total_amount
      FROM bills b
    `;
    
    const conditions = [];
    const params: any[] = [];
    
    // Apply same filters as regular list
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
    
    query += ' ORDER BY b.created_at DESC';
    
    // Execute query to get all matching records
    const result = await db.query(query, params);
    const bills = result.results || [];
    
    // Generate Excel data
    const { headers, rows } = generateExcelData(bills);
    
    // Create a new workbook and worksheet
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
    
    // Append the worksheet to the workbook
    xlsx.utils.book_append_sheet(wb, ws, 'Invoices');
    
    // Write the workbook to a buffer
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    // Set proper headers for Excel download
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="invoices_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx"`,
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Export failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function generateExcelData(bills: any[]) {
  // Excel headers
  const headers = [
    'Bill Number',
    'Customer Name', 
    'Invoice Date',
    'Amount Before Tax',
    'CGST',
    'SGST',
    'IGST',
    'Total Amount After Tax (₹)'
  ];
  
  // Format data rows
  const rows = bills.map(bill => [
    bill.bill_number || '',
    bill.customer_name || '',
    formatDate(bill.invoice_date),
    formatCurrency(bill.subtotal),
    formatCurrency(bill.cgst_amount),
    formatCurrency(bill.sgst_amount),
    formatCurrency(bill.igst_amount),
    formatCurrency(bill.total_amount)
  ]);
  
  return { headers, rows };
}

function formatDate(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (error) {
    return dateString;
  }
}

function formatCurrency(amount: any): number {
  return parseFloat(amount || 0);
}