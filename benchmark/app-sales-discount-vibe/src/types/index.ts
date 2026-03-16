// =====================
// Master Data Types
// =====================

export interface ProductCategory {
  id: number;
  category_name: string;
}

export interface Product {
  id: number;
  product_code: string;
  product_name: string;
  category_id: number;
  standard_unit_price: number;
  unit: string;
  active: number; // 0 = inactive, 1 = active
}

export interface Customer {
  id: number;
  customer_code: string;
  customer_name: string;
  address: string;
  phone: string;
  email: string;
  closing_day: number; // 0 = end of month, 1-28 = specific day
  credit_limit: number; // 0 = no credit check
}

export interface SpecialPrice {
  id: number;
  customer_id: number;
  product_id: number;
  special_unit_price: number;
}

export interface SystemSetting {
  key: string;
  value: string;
}

// =====================
// Persistent Data Types
// =====================

export interface Quotation {
  id: number;
  quotation_number: string;
  customer_id: number;
  subject: string;
  status: number; // 0=draft, 1=submitted, 2=ordered, 3=lost, 4=expired
  expiration_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuotationItem {
  id: number;
  quotation_id: number;
  product_id: number;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  quotation_id: number; // 0 = direct order (no quotation)
  subject: string;
  status: number; // 0=confirmed, 1=shipping in progress, 2=shipped, 3=invoiced, 4=completed, 5=cancelled
  credit_warning: number; // 0=no issue, 1=credit limit exceeded
  ordered_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  shipped_quantity: number;
}

export interface ProductInventory {
  product_id: number;
  physical_stock: number;
  allocated_quantity: number;
}

export interface ShippingInstruction {
  id: number;
  shipping_instruction_number: string;
  order_id: number;
  customer_id: number;
  status: number; // 0=pending, 1=shipping in progress, 2=shipped, 3=cancelled
  created_at: string;
}

export interface ShippingInstructionItem {
  id: number;
  shipping_instruction_id: number;
  order_item_id: number;
  product_id: number;
  instructed_quantity: number;
  shipped_quantity: number;
}

export interface ShippingRecord {
  id: number;
  shipping_instruction_item_id: number;
  shipped_quantity: number;
  shipped_at: string;
}

export interface Receiving {
  id: number;
  receipt_date: string;
  notes: string;
  registered_by: string;
  registered_at: string;
}

export interface ReceivingItem {
  id: number;
  receiving_id: number;
  product_id: number;
  received_quantity: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number;
  billing_period: string; // YYYY-MM
  invoice_amount: number;
  status: number; // 0=not issued, 1=issued, 2=partially paid, 3=paid in full
  issue_date: string;
  registered_at: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  order_item_id: number;
  product_id: number;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
}

export interface Payment {
  id: number;
  customer_id: number;
  payment_amount: number;
  payment_date: string;
  payment_method: number; // 0=bank transfer, 1=cash
  reconciliation_status: number; // 0=unreconciled, 1=partially reconciled, 2=fully reconciled
  unreconciled_balance: number;
  notes: string;
  registered_at: string;
}

export interface PaymentReconciliation {
  id: number;
  payment_id: number;
  invoice_id: number;
  reconciled_amount: number;
  reconciled_at: string;
}

// =====================
// API Response Types
// =====================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  details?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
