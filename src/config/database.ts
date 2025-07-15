// Cloudflare D1 Database Configuration (without Wrangler)
export interface DatabaseConfig {
  name: string;
  accountId: string;
  databaseId: string;
  apiToken: string;
}

export const DB_CONFIG: DatabaseConfig = {
  name: 'shagoonchairdb',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID || '',
  apiToken: process.env.CLOUDFLARE_API_TOKEN || ''
};

// Validate configuration
function validateConfig(config: DatabaseConfig): void {
  const missing = [];
  if (!config.accountId) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!config.databaseId) missing.push('CLOUDFLARE_D1_DATABASE_ID');
  if (!config.apiToken) missing.push('CLOUDFLARE_API_TOKEN');
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Database schema interfaces
export interface Bill {
  id?: number;
  bill_number: string;
  invoice_date: string;
  challan_number?: string;
  challan_date?: string;
  po_number?: string;
  po_date?: string;
  dispatch_details?: string;
  customer_name: string;
  customer_code?: number;
  customer_phone: string;
  customer_email?: string;
  customer_address?: string;
  customer_gst_number?: string;
  vendor_code?: string;
  hsn_code?: string;
  items: BillItem[];
  subtotal: number;
  cgst_percentage: number;
  cgst_amount: number;
  sgst_percentage: number;
  sgst_amount: number;
  igst_percentage: number;
  igst_amount: number;
  total_tax_amount: number;
  discount_percentage?: number;
  discount_amount?: number;
  total_amount: number;
  payment_method: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque' | 'dd';
  payment_status: 'paid' | 'pending' | 'partial';
  payment_terms?: string;
  bank_details?: BankDetails;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BillItem {
  id?: number;
  bill_id?: number;
  sr_no: number;
  product_name: string;
  product_description: string;
  product_category: string;
  hsn_code?: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  unit: string; // Nos, Kg, Meter, etc.
}

export interface BankDetails {
  bank_name: string;
  account_number: string;
  branch: string;
  ifsc_code: string;
  account_type: string;
}

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  gst_number: string;
  pan_number: string;
  state_code: string;
  logo_url?: string;
}

// D1 Database API Client
export class D1DatabaseClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(config: DatabaseConfig) {
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}`;
    this.headers = {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json'
    };
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          sql: sql,
          params: params
        })
      });

      if (!response.ok) {
        throw new Error(`D1 API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`D1 query failed: ${result.errors?.[0]?.message || 'Unknown error'}`);
      }

      return result.result[0]; // D1 returns an array, we want the first result
    } catch (error) {
      console.error('D1 Database query error:', error);
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    return this.query(sql, params);
  }

  async batch(statements: Array<{ sql: string; params?: any[] }>): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(statements)
      });

      if (!response.ok) {
        throw new Error(`D1 API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`D1 batch failed: ${result.errors?.[0]?.message || 'Unknown error'}`);
      }

      return result.result;
    } catch (error) {
      console.error('D1 Database batch error:', error);
      throw error;
    }
  }
}

// Initialize database client
export function initializeDatabase(): D1DatabaseClient {
  validateConfig(DB_CONFIG);
  const client = new D1DatabaseClient(DB_CONFIG);
  
  // Initialize tables on first connection
  initializeTables(client);
  
  return client;
}

async function initializeTables(client: D1DatabaseClient) {
  try {
    // Create tables if they don't exist
    const createBillsTable = `
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_number TEXT UNIQUE NOT NULL,
        invoice_date DATE NOT NULL,
        challan_number TEXT,
        challan_date DATE,
        po_number TEXT,
        po_date DATE,
        dispatch_details TEXT,
        customer_name TEXT NOT NULL,
        customer_code INTEGER,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        customer_address TEXT,
        customer_gst_number TEXT,
        vendor_code TEXT,
        hsn_code TEXT,
        subtotal REAL NOT NULL,
        cgst_percentage REAL DEFAULT 9.0,
        cgst_amount REAL DEFAULT 0,
        sgst_percentage REAL DEFAULT 9.0,
        sgst_amount REAL DEFAULT 0,
        igst_percentage REAL DEFAULT 18.0,
        igst_amount REAL DEFAULT 0,
        total_tax_amount REAL NOT NULL,
        discount_percentage REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'upi', 'bank_transfer', 'cheque', 'dd')),
        payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'pending', 'partial')),
        payment_terms TEXT,
        bank_name TEXT,
        bank_account_number TEXT,
        bank_branch TEXT,
        bank_ifsc_code TEXT,
        bank_account_type TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createBillItemsTable = `
      CREATE TABLE IF NOT EXISTS bill_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL,
        sr_no INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        product_description TEXT,
        product_category TEXT NOT NULL,
        hsn_code TEXT,
        unit_price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        total_price REAL NOT NULL,
        unit TEXT DEFAULT 'Nos',
        FOREIGN KEY (bill_id) REFERENCES bills (id) ON DELETE CASCADE
      )
    `;

    const createCompanyInfoTable = `
      CREATE TABLE IF NOT EXISTS company_info (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        gst_number TEXT NOT NULL,
        pan_number TEXT NOT NULL,
        state_code TEXT NOT NULL,
        logo_url TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills(bill_number)',
      'CREATE INDEX IF NOT EXISTS idx_bills_customer_name ON bills(customer_name)',
      'CREATE INDEX IF NOT EXISTS idx_bills_customer_code ON bills(customer_code)',
      'CREATE INDEX IF NOT EXISTS idx_bills_invoice_date ON bills(invoice_date)',
      'CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills(payment_status)',
      'CREATE INDEX IF NOT EXISTS idx_bills_customer_gst ON bills(customer_gst_number)',
      'CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id)',
      'CREATE INDEX IF NOT EXISTS idx_bill_items_hsn_code ON bill_items(hsn_code)'
    ];

    // Execute table creation and indexes
    const statements = [
      { sql: createBillsTable },
      { sql: createBillItemsTable },
      { sql: createCompanyInfoTable },
      ...indexes.map(sql => ({ sql }))
    ];

    await client.batch(statements);

    // Insert company information
    await insertCompanyInfo(client);

    // Insert sample data if tables are empty
    await insertSampleData(client);
    
    console.log('D1 Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize D1 database tables:', error);
  }
}

async function insertSampleData(client: D1DatabaseClient) {
  try {
    // Check if bills table is empty
    const countResult = await client.query('SELECT COUNT(*) as count FROM bills');
    const billCount = countResult.results[0]?.count || 0;
    
    if (billCount === 0) {
      console.log('Inserting sample data into D1 database...');
      
      // Sample bills data matching the invoice format
      const sampleBills = [
        [
          'BILL-710', '2025-07-06', 'CH-710', '2025-07-05', 'PO-2025-001', '2025-07-01', 'Dispatched via Mumbai Transport',
          'M/S. CUPS AND MOULDS LLP.', 1001, '+91 9820732807', 'cupsandmoulds@gmail.com',
          'B 17, PRAVASI INDUSTRIAL ESTATE, GATE NO. 1, 1ST FLOOR GOREGAON MULUND LINK ROAD, GOREGAON (EAST) MUMBAI-400063',
          '27AAQFC3444C1ZK', '*****', '9403',
          21950.00, 9.0, 1975.50, 9.0, 1975.50, 18.0, 0.00, 3951.00,
          0.0, 0.00, 25901.00, 'bank_transfer', 'paid',
          'Payment only by crossed cheques/DD payable in Mumbai',
          'INDIAN BANK', '641205735S', 'MALAD EAST', 'IDIB000M202', 'CURRENT A/C',
          'TWENTY FIVE THOUSAND NINE HUNDRED ONE RUPEES ONLY'
        ],
        [
          'BILL-711', '2025-07-07', 'CH-711', '2025-07-06', 'PO-2025-002', '2025-07-02', 'Dispatched via Express Logistics',
          'ABC FURNITURE MART', 1002, '+91 9876543210', 'abc@furniture.com',
          'Shop No. 15, Furniture Market, Andheri East, Mumbai-400069',
          '27BBBCC1234D5EF', 'VEN001', '9403',
          15000.00, 9.0, 1350.00, 9.0, 1350.00, 18.0, 0.00, 2700.00,
          5.0, 750.00, 16950.00, 'cash', 'pending',
          'Payment within 30 days',
          'INDIAN BANK', '641205735S', 'MALAD EAST', 'IDIB000M202', 'CURRENT A/C',
          'SIXTEEN THOUSAND NINE HUNDRED FIFTY RUPEES ONLY'
        ],
        [
          'BILL-712', '2025-07-08', 'CH-712', '2025-07-07', 'PO-2025-003', '2025-07-03', 'Self pickup by customer',
          'XYZ OFFICE SOLUTIONS', 1003, '+91 8765432109', 'xyz@office.com',
          'Office No. 201, Business Center, Bandra West, Mumbai-400050',
          '27CCCDD2345E6FG', 'VEN002', '9403',
          45000.00, 9.0, 4050.00, 9.0, 4050.00, 18.0, 0.00, 8100.00,
          10.0, 4500.00, 48600.00, 'upi', 'partial',
          'Payment terms as agreed',
          'INDIAN BANK', '641205735S', 'MALAD EAST', 'IDIB000M202', 'CURRENT A/C',
          'FORTY EIGHT THOUSAND SIX HUNDRED RUPEES ONLY'
        ]
      ];

      // Insert bills
      const billStatements = sampleBills.map(billData => ({
        sql: `INSERT INTO bills (
          bill_number, invoice_date, challan_number, challan_date, po_number, po_date, dispatch_details,
          customer_name, customer_code, customer_phone, customer_email, customer_address,
          customer_gst_number, vendor_code, hsn_code, subtotal, 
          cgst_percentage, cgst_amount, sgst_percentage, sgst_amount, igst_percentage, igst_amount, total_tax_amount,
          discount_percentage, discount_amount, total_amount, payment_method, payment_status, payment_terms,
          bank_name, bank_account_number, bank_branch, bank_ifsc_code, bank_account_type, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: billData
      }));

      const billResults = await client.batch(billStatements);

      // Sample items for each bill matching the invoice format
      const sampleItems = [
        [
          [1, 'MCD SS WOOD CHAIR ( MACK DOLOURE)', 'Premium wooden chair with mack doloure finish', 'Chair', '9403', 1600.00, 12, 19200.00, 'Nos'],
          [2, 'ROUND WOOD ONLY', 'Round wooden component', 'Wood Component', '9403', 550.00, 5, 2750.00, 'Nos']
        ],
        [
          [1, 'Executive Office Chair', 'Leather executive chair with ergonomic design', 'Chair', '9403', 2500.00, 6, 15000.00, 'Nos']
        ],
        [
          [1, 'Conference Table Set', 'Large conference table with chairs', 'Table', '9403', 15000.00, 3, 45000.00, 'Set']
        ]
      ];

      // Insert bill items
      const itemStatements: Array<{ sql: string; params: any[] }> = [];
      billResults.forEach((result, billIndex) => {
        const billId = result.meta?.last_row_id;
        if (billId && sampleItems[billIndex]) {
          sampleItems[billIndex].forEach(itemData => {
            itemStatements.push({
              sql: `INSERT INTO bill_items (
                bill_id, sr_no, product_name, product_description, product_category, hsn_code, unit_price, quantity, total_price, unit
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              params: [billId, ...itemData]
            });
          });
        }
      });

      if (itemStatements.length > 0) {
        await client.batch(itemStatements);
      }

      console.log('Sample data inserted successfully');
    }
  } catch (error) {
    console.error('Failed to insert sample data:', error);
  }
}

async function insertCompanyInfo(client: D1DatabaseClient) {
  try {
    // Check if company info exists
    const countResult = await client.query('SELECT COUNT(*) as count FROM company_info');
    const companyCount = countResult.results[0]?.count || 0;
    
    if (companyCount === 0) {
      console.log('Inserting company information...');
      
      await client.query(`
        INSERT INTO company_info (
          id, name, address, phone, email, gst_number, pan_number, state_code, logo_url
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'SHAGOON SEATING CHAIR',
        'GALA NO.07, KAUSHALYA RAMKARAN KEVET CHAWL, NEAR PRAVASI INDUSTRIAL ESTATE, 2ND MARK DORIAN ESTATE, MULUND LINK ROAD, GOREGAON EAST, MUMBAI-400063, MAHARASHTRA',
        '+91 9867071332/9769956235',
        'shagoonchair@gmail.com',
        '27AAQFC3444C1ZK',
        'ASOPG8588M',
        '27',
        null
      ]);
      
      console.log('Company information inserted successfully');
    }
  } catch (error) {
    console.error('Failed to insert company info:', error);
  }
}
