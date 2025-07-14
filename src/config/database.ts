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
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address?: string;
  items: BillItem[];
  subtotal: number;
  tax_percentage: number;
  tax_amount: number;
  discount_percentage?: number;
  discount_amount?: number;
  total_amount: number;
  payment_method: 'cash' | 'card' | 'upi' | 'bank_transfer';
  payment_status: 'paid' | 'pending' | 'partial';
  created_at: string;
  updated_at: string;
  notes?: string;
}

export interface BillItem {
  id?: number;
  bill_id?: number;
  product_name: string;
  product_category: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  description?: string;
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
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        customer_address TEXT,
        subtotal REAL NOT NULL,
        tax_percentage REAL DEFAULT 18.0,
        tax_amount REAL NOT NULL,
        discount_percentage REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'upi', 'bank_transfer')),
        payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'pending', 'partial')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `;

    const createBillItemsTable = `
      CREATE TABLE IF NOT EXISTS bill_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        product_category TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        description TEXT,
        FOREIGN KEY (bill_id) REFERENCES bills (id) ON DELETE CASCADE
      )
    `;

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills(bill_number)',
      'CREATE INDEX IF NOT EXISTS idx_bills_customer_name ON bills(customer_name)',
      'CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills(payment_status)',
      'CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id)'
    ];

    // Execute table creation and indexes
    const statements = [
      { sql: createBillsTable },
      { sql: createBillItemsTable },
      ...indexes.map(sql => ({ sql }))
    ];

    await client.batch(statements);

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
      
      // Sample bills data
      const sampleBills = [
        [
          'BILL-SAMPLE-001', 'Rajesh Kumar', '+91 98765 43210', 'rajesh@example.com',
          'Mumbai, Maharashtra, India', 20000.00, 18.0, 3600.00, 5.0, 1000.00,
          22600.00, 'upi', 'paid', 'Sample bill for testing'
        ],
        [
          'BILL-SAMPLE-002', 'Priya Sharma', '+91 87654 32109', 'priya@example.com',
          'Delhi, India', 15000.00, 18.0, 2700.00, 0.0, 0.00,
          17700.00, 'cash', 'pending', 'Cash payment pending'
        ],
        [
          'BILL-SAMPLE-003', 'Amit Patel', '+91 76543 21098', 'amit@example.com',
          'Ahmedabad, Gujarat, India', 35000.00, 18.0, 6300.00, 10.0, 3500.00,
          37800.00, 'card', 'partial', 'Partial payment received'
        ]
      ];

      // Insert bills
      const billStatements = sampleBills.map(billData => ({
        sql: `INSERT INTO bills (
          bill_number, customer_name, customer_phone, customer_email, customer_address,
          subtotal, tax_percentage, tax_amount, discount_percentage, discount_amount,
          total_amount, payment_method, payment_status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: billData
      }));

      const billResults = await client.batch(billStatements);

      // Sample items for each bill
      const sampleItems = [
        [
          ['Executive Office Chair', 'Chair', 2, 8000.00, 16000.00, 'Leather executive chair with ergonomic design'],
          ['Coffee Table', 'Table', 1, 4000.00, 4000.00, 'Modern glass coffee table']
        ],
        [
          ['Dining Chair Set', 'Chair', 4, 2500.00, 10000.00, 'Wooden dining chairs - set of 4'],
          ['Side Table', 'Table', 2, 2500.00, 5000.00, 'Compact side tables']
        ],
        [
          ['Luxury Sofa Set', 'Sofa', 1, 25000.00, 25000.00, '3-seater luxury sofa with cushions'],
          ['Center Table', 'Table', 1, 10000.00, 10000.00, 'Marble top center table']
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
                bill_id, product_name, product_category, quantity, unit_price, total_price, description
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
