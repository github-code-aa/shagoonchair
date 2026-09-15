import { extractNumericValue, type BillItem } from "../../config/database";

export interface TaxPercentages {
  cgst: number;
  sgst: number;
  igst: number;
  discount: number;
}

export interface InvoiceTotals {
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  discountAmount: number;
  totalAmount: number;
}

function normalizePercentage(value: unknown, fieldName: string): number {
  const percentage = Number(value ?? 0);

  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error(`${fieldName} must be between 0 and 100`);
  }

  return percentage;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateItemTotal(item: BillItem): number {
  const unitPrice = Number(item.unit_price);
  const quantity = extractNumericValue(item.quantity);

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new Error(`Item ${item.sr_no}: Unit price must be greater than 0`);
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Item ${item.sr_no}: Quantity must be greater than 0`);
  }

  return roundCurrency(unitPrice * quantity);
}

export function calculateInvoiceTotals(
  items: BillItem[],
  percentages: TaxPercentages,
): InvoiceTotals {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one item is required");
  }

  if (items.length > 15) {
    throw new Error("An invoice cannot contain more than 15 items");
  }

  const cgst = normalizePercentage(percentages.cgst, "CGST percentage");
  const sgst = normalizePercentage(percentages.sgst, "SGST percentage");
  const igst = normalizePercentage(percentages.igst, "IGST percentage");
  const discount = normalizePercentage(
    percentages.discount,
    "Discount percentage",
  );

  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + calculateItemTotal(item), 0),
  );
  const cgstAmount = roundCurrency((subtotal * cgst) / 100);
  const sgstAmount = roundCurrency((subtotal * sgst) / 100);
  const igstAmount = roundCurrency((subtotal * igst) / 100);
  const discountAmount = roundCurrency((subtotal * discount) / 100);
  const totalTaxAmount = roundCurrency(cgstAmount + sgstAmount + igstAmount);
  const totalAmount = roundCurrency(
    subtotal + totalTaxAmount - discountAmount,
  );

  return {
    subtotal,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTaxAmount,
    discountAmount,
    totalAmount,
  };
}
