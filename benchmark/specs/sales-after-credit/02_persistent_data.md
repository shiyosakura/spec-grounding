# BtoB Sales Management System — Persistent Data (Save Data)

> Data that increases, decreases, or changes during operation. Subject to database persistence.
> Always reference this file when writing specifications.
>
> Equivalent to "save data" in game terms. In business applications, this corresponds to transaction data and master-linked data.
>
> Designed for small and mid-sized businesses. Scale: up to 200 customers, 1,000 products, 500 orders per month.

---

| Category | Field Name | Range | Count | Description |
| :-- | :-- | :-- | :-- | :-- |
| Quotation | Quotation ID | 0-999999 | 1 | 0 = none (reserved value). Auto-incremented. Valid IDs are 1 and above |
| | Quotation Number | String | 1 | `System Settings.Quotation Number Prefix` + sequential number. Business display number |
| | Customer ID | 1-9999 | 1 | Reference ID for `Customer Master` |
| | Subject | String | 1 | Subject line of the quotation |
| | Status | 0-4 | 1 | 0 = draft, 1 = submitted, 2 = ordered, 3 = lost, 4 = expired |
| | Expiration Date | Date | 1 | Expiration date of the quotation |
| | Created By (User ID) | String | 1 | Account ID from the authentication framework |
| | Created At | DateTime | 1 | |
| | Updated At | DateTime | 1 | |
| Quotation Line Item | Quotation Line Item ID | 0-999999 | ×30 | 0 = unused slot. Maximum 30 lines per quotation |
| | Quotation ID | 0-999999 | ×30 | Reference ID for `Quotation` |
| | Product ID | 1-9999 | ×30 | Reference ID for `Product Master` |
| | Product Name (at Quotation) | String | ×30 | Snapshot of product name at time of quotation. Not affected by subsequent master changes |
| | Quantity | 1-99999 | ×30 | Ordered quantity |
| | Unit Price | 0-9999999 | ×30 | In yen. Set from `Special Price Master` special price or `Product Master.Standard Unit Price`; can be manually overridden |
| Order | Order ID | 0-999999 | 1 | 0 = none (reserved value). Auto-incremented. Valid IDs are 1 and above |
| | Order Number | String | 1 | `System Settings.Order Number Prefix` + sequential number |
| | Customer ID | 1-9999 | 1 | Reference ID for `Customer Master` |
| | Quotation ID | 0-999999 | 1 | 0 = no quotation (direct order). Reference ID for the source `Quotation` |
| | Subject | String | 1 | Subject line of the order (carried over from quotation) |
| | Status | 0-5 | 1 | 0 = confirmed, 1 = shipping in progress, 2 = shipped, 3 = invoiced, 4 = completed, 5 = cancelled |
| | Credit Warning Flag | 0-1 | 1 | 0 = no credit issue, 1 = credit limit exceeded at order confirmation (does not block order confirmation even if exceeded) |
| | Ordered At | DateTime | 1 | |
| | Updated At | DateTime | 1 | |
| Order Line Item | Order Line Item ID | 0-999999 | ×30 | 0 = unused slot. Maximum 30 lines per order |
| | Order ID | 0-999999 | ×30 | Reference ID for `Order` |
| | Product ID | 1-9999 | ×30 | Reference ID for `Product Master` |
| | Product Name (at Order) | String | ×30 | Snapshot of product name at time of order. Not affected by subsequent master changes |
| | Quantity | 1-99999 | ×30 | Ordered quantity |
| | Unit Price | 0-9999999 | ×30 | In yen. Copied from quotation line item |
| | Shipped Quantity | 0-99999 | ×30 | Incremented during shipping. 0 = not yet shipped |
| Product Inventory | Product ID | 1-9999 | 1 | Reference ID for `Product Master`. 1:1 correspondence with Product Master |
| | Physical Stock | 0-999999 | 1 | Current physical inventory count. Incremented on receipt, decremented on shipping confirmation |
| | Allocated Quantity | 0-999999 | 1 | Incremented on order confirmation, decremented on shipping confirmation or cancellation. Available Stock = Physical Stock − Allocated Quantity (UI hook) |
| Shipping Instruction | Shipping Instruction ID | 0-999999 | 1 | 0 = none (reserved value). Auto-incremented. Valid IDs are 1 and above |
| | Shipping Instruction Number | String | 1 | `System Settings.Shipping Instruction Number Prefix` + sequential number. Business display number |
| | Order ID | 1-999999 | 1 | Reference ID for `Order` |
| | Customer ID | 1-9999 | 1 | Reference ID for `Customer Master` (copied from `Order`) |
| | Status | 0-3 | 1 | 0 = pending, 1 = shipping in progress, 2 = shipped, 3 = cancelled |
| | Created At | DateTime | 1 | |
| Shipping Instruction Line Item | Shipping Instruction Line Item ID | 0-999999 | ×30 | 0 = unused slot. Maximum 30 lines per shipping instruction |
| | Shipping Instruction ID | 0-999999 | ×30 | Reference ID for `Shipping Instruction` |
| | Order Line Item ID | 1-999999 | ×30 | Reference ID for `Order Line Item` |
| | Product ID | 1-9999 | ×30 | Reference ID for `Product Master` |
| | Instructed Quantity | 1-99999 | ×30 | Quantity to be shipped (copied from `Order Line Item.Quantity`) |
| | Shipped Quantity | 0-99999 | ×30 | Incremented during shipping. 0 = not yet shipped. Equals instructed quantity when complete |
| Shipping Record | Shipping Record ID | 0-999999 | ×100 | 0 = unused slot. Cumulative record of partial shipments. Guideline: max 100 entries per shipping instruction line item |
| | Shipping Instruction Line Item ID | 1-999999 | ×100 | Reference ID for `Shipping Instruction Line Item` |
| | Shipped Quantity | 1-99999 | ×100 | Quantity shipped in this shipment |
| | Shipped At | DateTime | ×100 | Date and time of shipping confirmation |
| Receipt | Receipt ID | 0-999999 | 1 | 0 = none (reserved value). Auto-incremented. Valid IDs are 1 and above |
| | Receipt Date | Date | 1 | Date the receipt occurred |
| | Notes | String | 1 | Optional notes text |
| | Registered By (User ID) | String | 1 | Account ID from the authentication framework |
| | Registered At | DateTime | 1 | |
| Receipt Line Item | Receipt Line Item ID | 0-999999 | ×30 | 0 = unused slot. Maximum 30 lines per receipt |
| | Receipt ID | 0-999999 | ×30 | Reference ID for `Receipt` |
| | Product ID | 1-9999 | ×30 | Reference ID for `Product Master` |
| | Received Quantity | 1-999999 | ×30 | Quantity received |
| Invoice | Invoice ID | 0-999999 | 1 | 0 = none (reserved value). Auto-incremented. Valid IDs are 1 and above |
| | Invoice Number | String | 1 | `System Settings.Invoice Number Prefix` + sequential number |
| | Customer ID | 1-9999 | 1 | Reference ID for `Customer Master` |
| | Billing Period | String | 1 | YYYY-MM format. The year and month covered by this invoice |
| | Invoice Amount | 0-99999999 | 1 | In yen. Total invoice amount confirmed at time of issuance (snapshot of `Σ(Invoice Line Item.Quantity × Invoice Line Item.Unit Price) + Tax Amount`). References `System Settings.Consumption Tax Rate`. Does not change after issuance |
| | Status | 0-3 | 1 | 0 = not issued, 1 = issued, 2 = partially paid, 3 = paid in full |
| | Issue Date | Date | 1 | Date the invoice was issued |
| | Registered At | DateTime | 1 | |
| Invoice Line Item | Invoice Line Item ID | 0-999999 | ×50 | 0 = unused slot. Maximum 50 lines per invoice (higher limit to accommodate multiple orders) |
| | Invoice ID | 0-999999 | ×50 | Reference ID for `Invoice` |
| | Order Line Item ID | 1-999999 | ×50 | Reference ID for `Order Line Item`. Used for invoice-to-order traceability |
| | Product ID | 1-9999 | ×50 | Reference ID for `Product Master` |
| | Product Name (at Invoice) | String | ×50 | Snapshot of product name at time of invoice issuance (copied from `Order Line Item.Product Name (at Order)`). Not affected by subsequent master changes |
| | Quantity | 1-99999 | ×50 | Shipped quantity |
| | Unit Price | 0-9999999 | ×50 | In yen. Copied from `Order Line Item.Unit Price` |
| Payment | Payment ID | 0-999999 | 1 | 0 = none (reserved value). Auto-incremented. Valid IDs are 1 and above |
| | Customer ID | 1-9999 | 1 | Reference ID for `Customer Master` |
| | Payment Amount | 1-99999999 | 1 | In yen |
| | Payment Date | Date | 1 | |
| | Payment Method | 0-1 | 1 | 0 = bank transfer, 1 = cash |
| | Reconciliation Status | 0-2 | 1 | 0 = unreconciled, 1 = partially reconciled, 2 = fully reconciled |
| | Unreconciled Balance | 0-99999999 | 1 | Remaining amount after subtracting reconciled amounts from payment amount. Initial value = Payment Amount |
| | Notes | String | 1 | Optional notes text |
| | Registered At | DateTime | 1 | |
| Payment Reconciliation | Reconciliation ID | 0-999999 | ×20 | 0 = unused slot. Maximum 20 invoices can be reconciled per payment |
| | Payment ID | 0-999999 | ×20 | Reference ID for `Payment` |
| | Invoice ID | 1-999999 | ×20 | Reference ID for `Invoice` |
| | Reconciled Amount | 1-99999999 | ×20 | In yen. Amount applied from this payment to this invoice |
| | Reconciled At | DateTime | ×20 | |
