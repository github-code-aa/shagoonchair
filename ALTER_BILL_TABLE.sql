-- SQL Script to add bill_number column to existing bills table
-- Run this script on your Cloudflare D1 database

ALTER TABLE bills ADD COLUMN bill_number TEXT;

-- Optional: Create an index on bill_number for better query performance
CREATE INDEX IF NOT EXISTS idx_bills_bill_number ON bills(bill_number);

-- Verify the column was added
PRAGMA table_info(bills);


000000d9-00000000-00004f78-3adef36d7f877decc2693c935b40a50a