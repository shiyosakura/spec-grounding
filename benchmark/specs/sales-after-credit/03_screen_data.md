# BtoB Sales Management System — Screen Data (Temporary / In-Memory Data)

> Data that exists only while a screen is displayed. Discarded on screen navigation or session end.
> Always reference this file when writing specifications.
>
> Equivalent to "temporary variable data" in game terms. In business applications, this corresponds to screen state and view models.

---

| Category | Field Name | Range | Count | Description |
| :-- | :-- | :-- | :-- | :-- |
| Quotation List Screen | Filter Status | -1〜4 | 1 | -1 = show all, 0 = draft, 1 = submitted, 2 = ordered, 3 = lost, 4 = expired |
| | Search Text | String | 1 | Partial match search on quotation number and customer name. Empty string = no filter |
| Quotation Create/Edit Screen | Edit Mode | 0-1 | 1 | 0 = create new, 1 = edit existing |
| | Target Quotation ID | 0-999999 | 1 | 0 = new. 1 or above = reference ID of the `Quotation` being edited |
| Order List Screen | Filter Status | -1〜5 | 1 | -1 = show all, 0 = confirmed, 1 = shipping in progress, 2 = shipped, 3 = invoiced, 4 = completed, 5 = cancelled |
| | Search Text | String | 1 | Partial match search on order number and customer name. Empty string = no filter |
| Order Detail Screen | Active Order ID | 1-999999 | 1 | ID of the `Order` passed from the Order List Screen |
| Inventory List Screen | Search Text | String | 1 | Partial match search on product code and product name. Empty string = no filter |
| Shipping Instruction List Screen | Filter Status | -1〜2 | 1 | -1 = show all (excluding cancelled), 0 = pending, 1 = shipping in progress, 2 = shipped. `Shipping Instruction.Status` = 3 (cancelled) is not shown in the list |
| | Search Text | String | 1 | Partial match search on `Shipping Instruction.Shipping Instruction Number` and customer name. Empty string = no filter |
| Shipping Work Screen | Active Shipping Instruction ID | 1-999999 | 1 | ID of the `Shipping Instruction` passed from the Shipping Instruction List Screen |
| | Current Shipment Quantity | 0-99999 | ×30 | Quantity to ship this time for each shipping instruction line item row. Initial value 0 |
| Receipt Registration Screen | Input Receipt Date | Date | 1 | Input value for receipt date. Default = today |
| | Input Notes | String | 1 | Input value for notes. Empty string = not entered |
| Invoice List Screen | Filter Status | -1〜3 | 1 | -1 = show all, 0 = not issued, 1 = issued, 2 = partially paid, 3 = paid in full |
| | Search Text | String | 1 | Partial match search on invoice number and customer name. Empty string = no filter |
| Invoice Issuance Screen | Input Billing Period | String | 1 | YYYY-MM format. Input value for the target billing period |
| | Customer Selection Mode | 0-1 | 1 | 0 = all customers, 1 = individual selection |
| | Selected Customer ID List | 0-9999 | ×200 | Array of customer IDs when individual selection mode is active. 0 = unused slot |
| | Preview Display Flag | 0-1 | 1 | 0 = not shown, 1 = preview is displayed |
| Payment Registration Screen | Input Customer ID | 0-9999 | 1 | 0 = not selected. 1 or above = reference ID of the selected `Customer Master` |
| | Input Payment Amount | 0-99999999 | 1 | 0 = not entered |
| | Input Payment Date | Date | 1 | Default = today |
| | Input Payment Method | 0-1 | 1 | 0 = bank transfer, 1 = cash |
| Payment Reconciliation Screen | Selected Payment ID | 0-999999 | 1 | 0 = not selected. 1 or above = reference ID of the `Payment` being reconciled |
| | Reconciliation Amount Input | 0-99999999 | ×20 | Reconciliation amount input per invoice row. 0 = no reconciliation. Maximum 20 invoices |
| Product Management Screen | Target Product ID | 0-9999 | 1 | 0 = add new mode. 1 or above = edit mode (reference ID of the `Product Master` being edited) |
| | Search Text | String | 1 | Partial match search on product code and product name. Empty string = no filter |
| Customer Management Screen | Target Customer ID | 0-9999 | 1 | 0 = add new mode. 1 or above = edit mode (reference ID of the `Customer Master` being edited) |
| | Search Text | String | 1 | Partial match search on customer code and customer name. Empty string = no filter |
| Special Price Master Screen | Filter Customer ID | 0-9999 | 1 | 0 = show all customers. 1 or above = filter by specified customer |
| | Filter Product ID | 0-9999 | 1 | 0 = show all products. 1 or above = filter by specified product |
| | Target Special Price Master ID | 0-9999 | 1 | 0 = add new mode. 1 or above = edit mode (reference ID of the `Special Price Master` being edited) |
