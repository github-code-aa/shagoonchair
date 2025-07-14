# Shagoon Seating Chair - Business Website

A modern, responsive website for Shagoon Seating Chair built with Astro framework, featuring a complete billing system powered by Cloudflare D1 database.

## 🚀 Features

- **Modern Astro Website**: Fast, static site generation with responsive design
- **Billing System**: Complete bill management with Cloudflare D1 database
- **Product Showcase**: Portfolio with filtering and categorization
- **Contact Forms**: Customer inquiry handling
- **Mobile-First Design**: Optimized for all devices

## 🏗️ Project Structure

```text
/
├── public/              # Static assets
├── src/
│   ├── components/      # Reusable Astro components
│   ├── config/          # Database and app configuration
│   ├── layouts/         # Page layouts
│   ├── pages/           # Website pages and API routes
│   │   ├── api/         # API endpoints for billing
│   │   ├── bills/       # Bill management UI
│   │   └── ...          # Website pages
│   └── styles/          # CSS styles
├── .env.example         # Environment variables template
├── DATABASE_SETUP.md    # Database setup instructions
└── verify-d1-setup.js   # D1 database verification script
```

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd shagoonchair
npm install
```

### 2. Database Setup

1. **Create Cloudflare D1 Database**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to Workers & Pages → D1 SQL Database
   - Create a new database named `shagoonchairdb`

2. **Get API Credentials**:
   - Account ID from Cloudflare dashboard
   - Database ID from D1 database page
   - API Token with D1:Edit permissions

3. **Configure Environment**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your actual values
   ```

4. **Verify Setup**:
   ```bash
   npm run verify-d1
   ```

### 3. Start Development

```bash
npm run dev
```

Visit `http://localhost:4321` to see the website.

## 🧞 Commands

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run verify-d1`       | Verify Cloudflare D1 database setup             |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |

## 💾 Database

The billing system uses **Cloudflare D1** - a serverless SQL database accessed via REST API. No local database required!

### Features:
- **Bill Management**: Create, view, edit, delete bills
- **Customer Tracking**: Store customer information and history
- **Item Management**: Multiple items per bill with categories
- **Payment Tracking**: Multiple payment methods and status tracking
- **Reporting**: Sales summaries and analytics

### API Endpoints:
- `GET /api/bills?action=list` - List all bills with filtering
- `GET /api/bills?action=get&billNumber=BILL-123` - Get specific bill
- `POST /api/bills` - Create new bill
- `PUT /api/bills` - Update existing bill
- `DELETE /api/bills?billNumber=BILL-123` - Delete bill

## 🎨 Design System

- **Primary Color**: #2c3e50 (Navy blue)
- **Secondary Color**: #8b4513 (Saddle brown)  
- **Accent Color**: #e67e22 (Orange)
- **Typography**: Inter font family
- **Responsive**: Mobile-first design approach

## 📱 Pages

- **Home** (`/`): Hero section, features, product categories
- **About** (`/about`): Company story and values
- **Portfolio** (`/portfolio`): Product showcase with filtering
- **Bills** (`/bills`): Bill management system (admin)

## � Deployment

The site can be deployed to any static hosting provider:

### Vercel
```bash
npm run build
# Deploy to Vercel
```

### Netlify
```bash
npm run build
# Deploy dist/ folder to Netlify
```

### Environment Variables for Production:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`

## 📚 Documentation

- [Database Setup Guide](./DATABASE_SETUP.md) - Complete D1 setup instructions
- [Astro Documentation](https://docs.astro.build) - Framework documentation
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/) - Database documentation

## 🛠️ Development

### Database Verification
```bash
npm run verify-d1
```

### Local Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

## 🤝 Support

For technical support:
1. Check the [Database Setup Guide](./DATABASE_SETUP.md)
2. Run the verification script: `npm run verify-d1`
3. Check environment variables in `.env.local`
4. Review Cloudflare D1 dashboard for database status

$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; node simple-d1-test.js