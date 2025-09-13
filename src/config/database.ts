// Cloudflare D1 Database Configuration (supports both binding and REST API)
export interface DatabaseConfig {
  name: string;
  accountId: string;
  databaseId: string;
  apiToken: string;
}

export const DB_CONFIG: DatabaseConfig = {
  name: 'shagoonchairdb',
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '78ba55673298a7f5bda678055519beb9',
  databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID || 'b215f72f-a4f6-497d-a68f-2d92d373b524',
  apiToken: process.env.CLOUDFLARE_API_TOKEN || '8ecRNZiD_rtS2W_zYdNeXm9gxWIwfr-Ttv6Zg0Fb'
};

// Validate configuration
function validateConfig(config: DatabaseConfig): void {
  console.log('Validating database configuration...');
  console.log('Environment:', process.env.NODE_ENV || 'undefined');
  console.log('Account ID length:', config.accountId?.length || 0);
  console.log('Database ID length:', config.databaseId?.length || 0);
  console.log('API Token length:', config.apiToken?.length || 0);
  
  // Security check for production
  if (process.env.NODE_ENV === 'production' && process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    console.error('🚨 SECURITY WARNING: SSL certificate verification is disabled in production!');
    console.error('🚨 This is a serious security risk and should be fixed immediately!');
    throw new Error('SSL certificate verification must be enabled in production');
  }
  
  const missing = [];
  if (!config.accountId) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!config.databaseId) missing.push('CLOUDFLARE_D1_DATABASE_ID');
  if (!config.apiToken) missing.push('CLOUDFLARE_API_TOKEN');
  
  if (missing.length > 0) {
    console.error('Missing environment variables:', missing);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  console.log('Database config validated successfully');
}

// Database schema interfaces
export interface Bill {
  id?: number;
  bill_number?: string;
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
  terms_and_conditions?: string;
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
  quantity: string; // Changed from number to string to allow text + numbers
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
      console.log('🔍 Making D1 API request...');
      console.log('🔍 URL:', `${this.baseUrl}/query`);
      console.log('🔍 SQL:', sql);
      console.log('🔍 Params:', params);
      
      // Configure fetch for local development SSL issues
      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          sql: sql,
          params: params
        })
      };

      // Handle SSL certificate issues in local development only
      if (typeof process !== 'undefined' && 
          (process.env.NODE_ENV === 'development' || 
           process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0')) {
        console.log('🔧 Local development mode - SSL certificate verification disabled');
        console.log('⚠️  This should NEVER happen in production!');
        
        // Only disable SSL verification if explicitly allowed for local development
        if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }
      } else if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
        console.log('🔒 Production mode - SSL certificate verification enabled');
        // Ensure SSL verification is enabled in production
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
      
      const response = await fetch(`${this.baseUrl}/query`, fetchOptions);

      console.log('📥 Response status:', response.status);
      console.log('📥 Response statusText:', response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ D1 API Response:', errorText);
        throw new Error(`D1 API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ D1 API Result:', result);
      
      if (!result.success) {
        console.error('❌ D1 Query Error:', result.errors);
        throw new Error(`D1 query failed: ${result.errors?.[0]?.message || 'Unknown error'}`);
      }

      return result.result[0]; // D1 returns an array, we want the first result
    } catch (error) {
      console.error('❌ D1 Database query error:', error);
      throw error;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    return this.query(sql, params);
  }

  async batch(statements: Array<{ sql: string; params?: any[] }>): Promise<any[]> {
    try {
      console.log('🔍 Executing batch with', statements.length, 'statements...');
      
      const results = [];
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(`📤 Executing statement ${i + 1}/${statements.length}:`, statement.sql.substring(0, 50) + '...');
        
        try {
          const result = await this.query(statement.sql, statement.params || []);
          results.push(result);
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          console.error(`❌ Statement ${i + 1} failed:`, error);
          throw new Error(`Batch statement ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      console.log('✅ All batch statements executed successfully');
      return results;
    } catch (error) {
      console.error('❌ D1 Database batch error:', error);
      throw error;
    }
  }
}

// Database client cache
let dbClient: D1DatabaseClient | null = null;
let initializationPromise: Promise<D1DatabaseClient> | null = null;

// Initialize database client
export async function initializeDatabase(): Promise<D1DatabaseClient> {
  // Return cached client if already initialized
  if (dbClient) {
    return dbClient;
  }
  
  // Return existing initialization promise if in progress
  if (initializationPromise) {
    return initializationPromise;
  }
  
  // Start new initialization
  initializationPromise = (async () => {
    console.log('Initializing database client...');
    validateConfig(DB_CONFIG);
    const client = new D1DatabaseClient(DB_CONFIG);
    
    // Initialize tables on first connection
    await initializeTables(client);
    
    // Cache the client
    dbClient = client;
    initializationPromise = null;
    
    return client;
  })();
  
  return initializationPromise;
}

async function initializeTables(client: D1DatabaseClient) {
  try {
    console.log('Starting database table initialization...');
    
    // Create tables if they don't exist
    const createBillsTable = `
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_number TEXT,
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
        terms_and_conditions TEXT,
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
        quantity TEXT NOT NULL,
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

    // Execute table creation
    console.log('Creating bills table...');
    await client.execute(createBillsTable);
    
    console.log('Creating bill_items table...');
    await client.execute(createBillItemsTable);
    
    console.log('Creating company_info table...');
    await client.execute(createCompanyInfoTable);

    // Create indexes for better performance
    console.log('Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_bills_customer_name ON bills(customer_name)',
      'CREATE INDEX IF NOT EXISTS idx_bills_customer_code ON bills(customer_code)',
      'CREATE INDEX IF NOT EXISTS idx_bills_invoice_date ON bills(invoice_date)',
      'CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON bills(payment_status)',
      'CREATE INDEX IF NOT EXISTS idx_bills_customer_gst ON bills(customer_gst_number)',
      'CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON bill_items(bill_id)',
      'CREATE INDEX IF NOT EXISTS idx_bill_items_hsn_code ON bill_items(hsn_code)'
    ];

    for (const indexSql of indexes) {
      await client.execute(indexSql);
    }

    // Insert company information
    console.log('Inserting company information...');
    await insertCompanyInfo(client);

    // Insert sample data if tables are empty
    // console.log('Checking for sample data...');
    // await insertSampleData(client);
    
    console.log('D1 Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize D1 database tables:', error);
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

// Utility function to extract numeric value from text
export function extractNumericValue(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    // Extract first number found in the string
    const match = value.match(/\d+\.?\d*/);
    return match ? parseFloat(match[0]) : 0;
  }
  
  return 0;
}
