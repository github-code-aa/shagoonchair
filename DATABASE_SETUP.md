# Shagoon Chair Billing System - Cloudflare D1 Database Setup

This document provides instructions for setting up the billing system with Cloudflare D1 database using direct REST API access (no Wrangler required).

## Prerequisites

1. Node.js installed
2. Cloudflare account with D1 database access
3. Cloudflare API token with D1 permissions

## Database Setup

### 1. Create Cloudflare D1 Database

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **D1 SQL Database**
3. Click **Create Database**
4. Name your database: `shagoonchairdb`
5. Copy the **Database ID** for configuration

### 2. Create API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use **Custom token** template
4. Set permissions:
   - **Account** - `Cloudflare D1:Edit`
   - **Zone Resources** - Include: All zones from account
5. Copy the generated API token

### 3. Configure Environment Variables

Create a `.env.local` file (copy from `.env.example`):
```bash
# Copy environment template
cp .env.example .env.local

# Edit with your actual values
# CLOUDFLARE_ACCOUNT_ID=your_account_id_here
# CLOUDFLARE_D1_DATABASE_ID=your_database_id_here  
# CLOUDFLARE_API_TOKEN=your_api_token_here
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Initialize Database

The D1 database will be automatically initialized when you first run the application:

```bash
# Start the development server
npm run dev
```

The database tables and sample data will be created automatically via D1 REST API.

## Local Development

### 1. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:4321`

### 2. Test API Endpoints

The billing system provides the following API endpoints:

- `GET /api/bills?action=list` - List all bills
- `GET /api/bills?action=get&billNumber=BILL-123` - Get specific bill
- `POST /api/bills` - Create new bill
- `PUT /api/bills` - Update existing bill
- `DELETE /api/bills?billNumber=BILL-123` - Delete bill

## Production Deployment

### 1. Environment Variables

Ensure your production environment has the following variables set:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`

### 2. Build for Production

```bash
npm run build
```

### 3. Deploy to Any Static Host

You can deploy to:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting provider

The D1 database is accessed via REST API, so no server-side deployment is required.

## Database Management

### Direct D1 API Access

The system uses Cloudflare D1 REST API directly. You can also manage the database through:
1. **Cloudflare Dashboard**: Navigate to D1 database in your Cloudflare dashboard
2. **Wrangler CLI** (optional): `npx wrangler d1 execute shagoonchairdb --command "SELECT * FROM bills"`
3. **Direct REST API**: Use tools like curl or Postman with D1 REST endpoints

### Sample Database Queries

You can run these queries through the Cloudflare Dashboard or Wrangler CLI:

```sql
-- Get all bills summary
SELECT bill_number, customer_name, total_amount, payment_status, created_at 
FROM bills 
ORDER BY created_at DESC;

-- Get bills by status
SELECT * FROM bills WHERE payment_status = 'pending';

-- Get total sales amount
SELECT SUM(total_amount) as total_sales FROM bills WHERE payment_status = 'paid';

-- Get bills for a specific month
SELECT * FROM bills 
WHERE strftime('%Y-%m', created_at) = '2024-01';

-- Get customer with highest purchase
SELECT customer_name, SUM(total_amount) as total_spent 
FROM bills 
GROUP BY customer_name 
ORDER BY total_spent DESC 
LIMIT 10;
```

### Backup and Export

#### Using Wrangler CLI:
```bash
# Install Wrangler (optional)
npm install -g wrangler

# Export data
wrangler d1 export shagoonchairdb --output=backup.sql

# Import data
wrangler d1 execute shagoonchairdb --file=backup.sql
```

#### Using REST API:
Data backup can be handled through the application's API endpoints or by querying all records.

## Features

### Bill Management
- Create new bills with multiple items
- View all bills with filtering and search
- Edit existing bills
- Delete bills
- Payment status tracking

### Customer Management
- Customer information storage
- Purchase history tracking
- Contact details management

### Reporting
- Sales summaries
- Payment status reports
- Product category analysis
- Monthly/yearly reports

## Security Considerations

1. **API Token Security**: Keep your Cloudflare API token secure and never commit it to version control
2. **Environment Variables**: Use `.env.local` for sensitive configuration
3. **Data Validation**: All inputs are validated before database operations
4. **SQL Injection Protection**: Uses prepared statements via D1 REST API
5. **Access Control**: Restricted to authenticated users only

## Troubleshooting

### Common Issues

1. **D1 API Authentication Errors**
   - Verify your Cloudflare API token has D1:Edit permissions
   - Check that your account ID and database ID are correct
   - Ensure the API token hasn't expired

2. **Database Initialization Errors**
   - Check browser console for detailed error messages
   - Verify D1 database exists in your Cloudflare dashboard
   - Ensure API credentials are properly set in environment variables

3. **API Connection Errors**
   - Check internet connectivity to Cloudflare API
   - Verify firewall settings allow HTTPS requests
   - Check server logs in terminal for detailed error messages

4. **Environment Variable Issues**
   - Ensure `.env.local` file exists and has correct values
   - Restart development server after changing environment variables
   - Check that variable names match exactly (case-sensitive)

### Debug Commands

#### Check Environment Variables:
```bash
# In Node.js, you can verify variables are loaded
node -e "console.log(process.env.CLOUDFLARE_ACCOUNT_ID)"
```

#### Test D1 API Connection:
```bash
# Using curl to test D1 API directly
curl -X POST "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/d1/database/YOUR_DATABASE_ID/query" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT COUNT(*) as count FROM bills"}'
```

## Authentication Troubleshooting

If you're getting authentication errors (Error Code 10000), follow these steps:

### 1. Verify API Token Permissions

Your Cloudflare API token must have the following permissions:
- **Zone:Zone Settings:Read** (for account access)
- **Account:Cloudflare D1:Edit** (for database operations)

To check/recreate your API token:
1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Find your token or create a new one
3. Click **"Custom token"**
4. Set these permissions:
   - **Account** - Cloudflare D1:Edit
   - **Zone Resources** - Include All zones from account (or specific zone)
5. Copy the new token and update your `.env.local` file

### 2. Verify Account and Database IDs

#### Account ID:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. In the right sidebar, copy your **Account ID**

#### Database ID:
1. Go to **Workers & Pages** → **D1 SQL Database**
2. Click on your database name
3. Copy the **Database ID** from the right sidebar

### 3. Test API Connection

Run this command to test your configuration:
```bash
# Windows PowerShell
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; node simple-d1-test.js

# Or if you have proper SSL certificates
node simple-d1-test.js
```

### 4. Create Database if Missing

If you get a "database not found" error:
1. Go to **Workers & Pages** → **D1 SQL Database**
2. Click **Create Database**
3. Name it: `shagoonchairdb`
4. Copy the new Database ID

## D1 Database Schema

The system automatically creates the following tables:

### Bills Table
- `id`: Primary key
- `bill_number`: Unique bill identifier
- `customer_name`: Customer name
- `customer_phone`: Customer phone
- `customer_email`: Customer email (optional)
- `customer_address`: Customer address (optional)
- `subtotal`: Bill subtotal
- `tax_percentage`: Tax percentage
- `tax_amount`: Tax amount
- `discount_percentage`: Discount percentage
- `discount_amount`: Discount amount
- `total_amount`: Total bill amount
- `payment_method`: Payment method
- `payment_status`: Payment status
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp
- `notes`: Additional notes

### Bill Items Table
- `id`: Primary key
- `bill_id`: Foreign key to bills table
- `product_name`: Product name
- `product_category`: Product category
- `quantity`: Quantity
- `unit_price`: Unit price
- `total_price`: Total price for item
- `description`: Item description (optional)

## Support

For issues related to:
- Cloudflare D1: [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- D1 REST API: [D1 HTTP API Reference](https://developers.cloudflare.com/api/operations/cloudflare-d1-query-database)
- Astro Framework: [Astro Documentation](https://docs.astro.build/)
- Environment Variables: [Astro Environment Variables](https://docs.astro.build/en/guides/environment-variables/)
