# BtoB Sales Management System — Master Data (Fixed Data)

> Fixed data referenced by all screens and features. Can be modified via the admin screen during operation, but does not change while Quotation / Order / Shipping Instruction / Invoice processing is in progress.
> Always reference this file when writing specifications.
>
> Designed for small and mid-sized businesses. Scale: up to 200 customers and 1,000 products.
> 4 modules (Order Management, Inventory & Shipping Management, Invoice & Payment Management, Master Management) — 15 screens.

---

| Category | Field Name | Range | Count | Description |
| :-- | :-- | :-- | :-- | :-- |
| Product Category | Category ID | 0-99 | 1 | 0 = uncategorized (reserved value). Valid IDs are 1 and above |
| | Category Name | String | 1 | Used for UI display |
| Product Master | Product ID | 0-9999 | 1 | 0 = none (reserved value). Valid IDs are 1 and above |
| | Product Code | String | 1 | Business identifier (e.g., PRD-001). Unique constraint. Searchable |
| | Product Name | String | 1 | Used for UI display. Searchable |
| | Category ID | 0-99 | 1 | Reference ID for `Product Category` |
| | Standard Unit Price | 0-9999999 | 1 | In yen. Default price when no special price exists in `Special Price Master` |
| | Unit | String | 1 | Unit of trade: e.g., piece, box, kg |
| | Active Flag | 0-1 | 1 | 0 = inactive (not shown as a selectable product in Quotation/Order), 1 = active |
| Customer Master | Customer ID | 0-9999 | 1 | 0 = none (reserved value). Valid IDs are 1 and above |
| | Customer Code | String | 1 | Business identifier (e.g., CUS-001). Unique constraint. Searchable |
| | Customer Name | String | 1 | Used for UI display. Searchable |
| | Address | String | 1 | Recipient address for invoices and delivery notes |
| | Phone Number | String | 1 | |
| | Email Address | String | 1 | |
| | Closing Day | 0-28 | 1 | Monthly billing closing day. 0 = end of month (sentinel value). 1–28 = specific day |
| | Credit Limit | 0-99999999 | 1 | In yen. Credit check threshold at order confirmation. 0 = no credit check |
| Special Price Master | Special Price Master ID | 0-9999 | 1 | 0 = none (reserved value). Valid IDs are 1 and above |
| | Customer ID | 1-9999 | 1 | Reference ID for `Customer Master` |
| | Product ID | 1-9999 | 1 | Reference ID for `Product Master`. Unique per combination of Customer ID × Product ID |
| | Special Unit Price | 0-9999999 | 1 | In yen. Special price for this customer. Takes precedence over `Product Master.Standard Unit Price` |
| System Settings | Consumption Tax Rate | 0-100 | 1 | In percent. Default 10. Tax calculation formula: `Total Amount × Consumption Tax Rate ÷ 100` |
| | Quotation Validity Days | 1-365 | 1 | Default expiration period in days when creating a quotation. Default 30 |
| | Quotation Number Prefix | String | 1 | Prefix for quotation numbers (e.g., EST-) |
| | Order Number Prefix | String | 1 | Prefix for order numbers (e.g., ORD-) |
| | Invoice Number Prefix | String | 1 | Prefix for invoice numbers (e.g., INV-) |
| | Shipping Instruction Number Prefix | String | 1 | Prefix for shipping instruction numbers (e.g., SHP-) |
