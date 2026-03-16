"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast, ToastContainer } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Customer {
  id: number;
  customer_code: string;
  customer_name: string;
}

interface Product {
  id: number;
  product_code: string;
  product_name: string;
  standard_unit_price: number;
}

interface SpecialPrice {
  customer_id: number;
  product_id: number;
  special_unit_price: number;
}

interface LineItem {
  key: string; // client-side key for React
  product_id: number;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
}

function QuotationEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const isEditMode = !!editId;

  const { toasts, success: showSuccess, error: showError, removeToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [specialPrices, setSpecialPrices] = useState<SpecialPrice[]>([]);

  const [quotationNumber, setQuotationNumber] = useState("");
  const [customerId, setCustomerId] = useState(0);
  const [subject, setSubject] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [status, setStatus] = useState(0);
  const [items, setItems] = useState<LineItem[]>([]);
  const [taxRate, setTaxRate] = useState(10);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Validation error states
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Confirm dialog states
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [confirmLostDeal, setConfirmLostDeal] = useState(false);

  const generateKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Load master data
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [custRes, prodRes] = await Promise.all([
          fetch("/api/customers"),
          fetch("/api/products"),
        ]);
        const custJson = await custRes.json();
        const prodJson = await prodRes.json();

        if (custJson.success) setCustomers(custJson.data);
        if (prodJson.success) {
          // §4-2: Only active products (active_flag = 1) in dropdown
          setProducts(prodJson.data.filter((p: Product & { active: number }) => p.active === 1));
        }
      } catch {
        showError("Failed to load master data");
      }
    };
    loadMasterData();
  }, [showError]);

  // Load special prices when needed (fetch all, filter client-side)
  useEffect(() => {
    const loadSpecialPrices = async () => {
      try {
        const res = await fetch("/api/special-prices");
        const json = await res.json();
        if (json.success) setSpecialPrices(json.data);
      } catch {
        // Special prices API may not exist - that's okay, we'll use standard prices
        setSpecialPrices([]);
      }
    };
    loadSpecialPrices();
  }, []);

  // Load system settings (tax rate)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/dashboard");
        // tax rate from system settings is separate, use default 10
      } catch {
        // ignore
      }
    };
    loadSettings();
  }, []);

  // §3-4: Load existing quotation data or initialize new
  useEffect(() => {
    const loadQuotation = async () => {
      if (isEditMode) {
        try {
          const res = await fetch(`/api/quotations/${editId}`);
          const json = await res.json();
          if (json.success) {
            const q = json.data;
            setQuotationNumber(q.quotation_number);
            setCustomerId(q.customer_id);
            setSubject(q.subject);
            setExpirationDate(q.expiration_date);
            setStatus(q.status);
            setItems(
              q.items.map((item: { product_id: number; product_name_snapshot: string; quantity: number; unit_price: number }) => ({
                key: generateKey(),
                product_id: item.product_id,
                product_name_snapshot: item.product_name_snapshot,
                quantity: item.quantity,
                unit_price: item.unit_price,
              }))
            );
          } else {
            showError("Quotation not found");
            router.push("/quotations");
          }
        } catch {
          showError("Failed to load quotation");
        }
      } else {
        // New creation: set default expiration date (today + 30 days)
        const today = new Date();
        today.setDate(today.getDate() + 30);
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        setExpirationDate(`${yyyy}-${mm}-${dd}`);
        setQuotationNumber("(Auto-assigned on save)");
      }
      setLoading(false);
    };
    loadQuotation();
  }, [editId, isEditMode, router, showError]);

  // §2-5: Auto Unit Price Set
  const getUnitPrice = useCallback(
    (customerIdVal: number, productId: number): number => {
      // Check special price first
      const special = specialPrices.find(
        (sp) => sp.customer_id === customerIdVal && sp.product_id === productId
      );
      if (special) return special.special_unit_price;

      // Fall back to product standard_unit_price
      const product = products.find((p) => p.id === productId);
      return product?.standard_unit_price ?? 0;
    },
    [specialPrices, products]
  );

  // Handle product selection in a line item
  const handleProductChange = (index: number, productId: number) => {
    setItems((prev) => {
      const updated = [...prev];
      const product = products.find((p) => p.id === productId);
      updated[index] = {
        ...updated[index],
        product_id: productId,
        product_name_snapshot: product?.product_name ?? "",
        unit_price: customerId ? getUnitPrice(customerId, productId) : (product?.standard_unit_price ?? 0),
      };
      return updated;
    });
  };

  // Handle quantity change
  const handleQuantityChange = (index: number, quantity: number) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity };
      return updated;
    });
  };

  // Handle unit price change (manual override)
  const handleUnitPriceChange = (index: number, unitPrice: number) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], unit_price: unitPrice };
      return updated;
    });
  };

  // Add row
  const addRow = () => {
    setItems((prev) => [
      ...prev,
      { key: generateKey(), product_id: 0, product_name_snapshot: "", quantity: 1, unit_price: 0 },
    ]);
  };

  // Remove row
  const removeRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // When customer changes, re-apply auto unit price for all items
  const handleCustomerChange = (newCustomerId: number) => {
    setCustomerId(newCustomerId);
    if (newCustomerId > 0) {
      setItems((prev) =>
        prev.map((item) => {
          if (item.product_id > 0) {
            return {
              ...item,
              unit_price: getUnitPrice(newCustomerId, item.product_id),
            };
          }
          return item;
        })
      );
    }
  };

  // §2-6 / §4-3: Total amount recalculation
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = Math.floor((subtotal * taxRate) / 100);
  const grandTotal = subtotal + taxAmount;

  const formatCurrency = (amount: number) => `\u00a5${amount.toLocaleString()}`;

  // §2-7: Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!customerId) newErrors.customer = "Please select a customer.";
    if (!subject.trim()) newErrors.subject = "Please enter a subject.";
    if (items.length === 0) newErrors.items = "Please add at least one line item row.";

    for (let i = 0; i < items.length; i++) {
      if (!items[i].product_id) {
        newErrors[`item_product_${i}`] = "Please set a product for all line item rows.";
      }
      if (items[i].quantity < 1) {
        newErrors[`item_quantity_${i}`] = "Please set a quantity of 1 or more for all line item rows.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // §3-7: Save Draft
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      const payload = {
        customer_id: customerId,
        subject: subject.trim(),
        expiration_date: expirationDate,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      };

      let res: Response;
      if (isEditMode) {
        res = await fetch(`/api/quotations/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/quotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (json.success) {
        showSuccess("Quotation saved successfully.");
        router.push("/quotations");
      } else {
        showError(json.error || "Failed to save quotation");
      }
    } catch {
      showError("Failed to save quotation");
    } finally {
      setSaving(false);
    }
  };

  // §3-8: Submit
  const handleSubmit = async () => {
    if (!validate()) return;
    setConfirmSubmit(true);
  };

  const doSubmit = async () => {
    setConfirmSubmit(false);
    setSaving(true);

    try {
      const payload = {
        customer_id: customerId,
        subject: subject.trim(),
        expiration_date: expirationDate,
        status: 1, // Submitted
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      };

      let res: Response;
      if (isEditMode) {
        res = await fetch(`/api/quotations/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // New creation with submit: create then submit
        const createRes = await fetch("/api/quotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, status: undefined }),
        });
        const createJson = await createRes.json();
        if (!createJson.success) {
          showError(createJson.error || "Failed to create quotation");
          setSaving(false);
          return;
        }
        // Then submit
        res = await fetch(`/api/quotations/${createJson.data.id}/submit`, {
          method: "POST",
        });
      }

      const json = await res.json();
      if (json.success) {
        showSuccess("Quotation submitted successfully.");
        router.push("/quotations");
      } else {
        showError(json.error || "Failed to submit quotation");
      }
    } catch {
      showError("Failed to submit quotation");
    } finally {
      setSaving(false);
    }
  };

  // §3-9: Order Conversion
  const handleConvert = () => {
    setConfirmConvert(true);
  };

  const doConvert = async () => {
    setConfirmConvert(false);
    setSaving(true);

    try {
      const res = await fetch(`/api/quotations/${editId}/convert`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        const msg = json.data.creditWarning
          ? "Order created successfully. Warning: Credit limit exceeded."
          : "Order created successfully.";
        showSuccess(msg);
        router.push("/orders");
      } else {
        showError(json.error || "Failed to convert to order");
      }
    } catch {
      showError("Failed to convert to order");
    } finally {
      setSaving(false);
    }
  };

  // §3-10: Lost Deal
  const handleLostDeal = () => {
    setConfirmLostDeal(true);
  };

  const doLostDeal = async () => {
    setConfirmLostDeal(false);
    setSaving(true);

    try {
      const res = await fetch(`/api/quotations/${editId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        showSuccess("Quotation marked as lost.");
        router.push("/quotations");
      } else {
        showError(json.error || "Failed to process lost deal");
      }
    } catch {
      showError("Failed to process lost deal");
    } finally {
      setSaving(false);
    }
  };

  // §4-2: Button states
  const canConvert = isEditMode && status === 1;
  const canLostDeal = isEditMode && status === 1;
  const canEdit = !isEditMode || status === 0 || status === 1;

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={confirmSubmit}
        title="Submit Quotation"
        message="Are you sure you want to submit this quotation? It will be available for order conversion."
        confirmLabel="Submit"
        onConfirm={doSubmit}
        onCancel={() => setConfirmSubmit(false)}
      />
      <ConfirmDialog
        open={confirmConvert}
        title="Convert to Order"
        message="Are you sure you want to convert this quotation to an order? This action cannot be undone."
        confirmLabel="Convert"
        onConfirm={doConvert}
        onCancel={() => setConfirmConvert(false)}
      />
      <ConfirmDialog
        open={confirmLostDeal}
        title="Lost Deal"
        message="Are you sure you want to mark this quotation as a lost deal?"
        confirmLabel="Mark as Lost"
        destructive
        onConfirm={doLostDeal}
        onCancel={() => setConfirmLostDeal(false)}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {isEditMode ? "Edit Quotation" : "New Quotation"}
        </h1>
        <button
          onClick={() => router.push("/quotations")}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Back to List
        </button>
      </div>

      {/* Header Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quotation Number (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quotation Number
            </label>
            <input
              type="text"
              value={quotationNumber}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 text-sm"
            />
          </div>

          {/* Status (read-only for existing) */}
          {isEditMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <div className="px-3 py-2">
                <span
                  className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                    status === 0
                      ? "bg-gray-100 text-gray-700"
                      : status === 1
                      ? "bg-blue-100 text-blue-700"
                      : status === 2
                      ? "bg-green-100 text-green-700"
                      : status === 3
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {["Draft", "Submitted", "Ordered", "Lost", "Expired"][status] ?? "Unknown"}
                </span>
              </div>
            </div>
          )}

          {/* Customer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <select
              value={customerId}
              onChange={(e) => handleCustomerChange(Number(e.target.value))}
              disabled={!canEdit}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.customer ? "border-red-500" : "border-gray-300"
              } ${!canEdit ? "bg-gray-50 text-gray-500" : ""}`}
            >
              <option value={0}>-- Select Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_name} ({c.customer_code})
                </option>
              ))}
            </select>
            {errors.customer && (
              <p className="text-red-500 text-xs mt-1">{errors.customer}</p>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={!canEdit}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.subject ? "border-red-500" : "border-gray-300"
              } ${!canEdit ? "bg-gray-50 text-gray-500" : ""}`}
              placeholder="Enter subject"
            />
            {errors.subject && (
              <p className="text-red-500 text-xs mt-1">{errors.subject}</p>
            )}
          </div>

          {/* Expiration Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiration Date
            </label>
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              disabled={!canEdit}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !canEdit ? "bg-gray-50 text-gray-500" : ""
              }`}
            />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Line Items</h2>
          {canEdit && (
            <button
              onClick={addRow}
              className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
            >
              Add Row
            </button>
          )}
        </div>

        {errors.items && (
          <p className="text-red-500 text-xs mb-3">{errors.items}</p>
        )}

        {items.length === 0 ? (
          <div className="text-center text-gray-400 py-8 border-2 border-dashed border-gray-200 rounded-md">
            No line items. Click &quot;Add Row&quot; to add products.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-8">#</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Product</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">Quantity</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 w-36">Unit Price</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 w-36">Subtotal</th>
                  {canEdit && (
                    <th className="text-center px-3 py-2 font-medium text-gray-600 w-16">
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const rowSubtotal = item.quantity * item.unit_price;
                  return (
                    <tr key={item.key} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-400">{index + 1}</td>
                      <td className="px-3 py-2">
                        {canEdit ? (
                          <div>
                            <select
                              value={item.product_id}
                              onChange={(e) =>
                                handleProductChange(index, Number(e.target.value))
                              }
                              className={`w-full px-2 py-1.5 border rounded text-sm ${
                                errors[`item_product_${index}`]
                                  ? "border-red-500"
                                  : "border-gray-300"
                              }`}
                            >
                              <option value={0}>-- Select Product --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.product_name} ({p.product_code})
                                </option>
                              ))}
                            </select>
                            {errors[`item_product_${index}`] && (
                              <p className="text-red-500 text-xs mt-1">
                                {errors[`item_product_${index}`]}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span>{item.product_name_snapshot}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canEdit ? (
                          <div>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                handleQuantityChange(index, Math.max(0, parseInt(e.target.value) || 0))
                              }
                              min={1}
                              max={99999}
                              className={`w-full px-2 py-1.5 border rounded text-sm text-right ${
                                errors[`item_quantity_${index}`]
                                  ? "border-red-500"
                                  : "border-gray-300"
                              }`}
                            />
                            {errors[`item_quantity_${index}`] && (
                              <p className="text-red-500 text-xs mt-1">
                                {errors[`item_quantity_${index}`]}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-right">{item.quantity.toLocaleString()}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canEdit ? (
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) =>
                              handleUnitPriceChange(
                                index,
                                Math.max(0, parseInt(e.target.value) || 0)
                              )
                            }
                            min={0}
                            max={9999999}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                          />
                        ) : (
                          <div className="text-right font-mono">
                            {formatCurrency(item.unit_price)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatCurrency(rowSubtotal)}
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => removeRow(index)}
                            className="text-red-500 hover:text-red-700 text-sm font-medium"
                            title="Remove row"
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* §4-3: Total Amount Summary */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal (tax-exclusive):</span>
                <span className="font-mono font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Consumption Tax ({taxRate}%):</span>
                <span className="font-mono font-medium">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Grand Total:</span>
                <span className="font-mono">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap gap-3 justify-between">
          <div className="flex gap-3">
            {canEdit && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? "Saving..." : "Save Draft"}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? "Processing..." : "Submit"}
                </button>
              </>
            )}
          </div>

          <div className="flex gap-3">
            {/* §4-2: Order Conversion button - active only when status = 1 (Submitted) */}
            <button
              onClick={handleConvert}
              disabled={!canConvert || saving}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                canConvert
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Convert to Order
            </button>

            {/* §4-2: Lost Deal button - active only when status = 1 (Submitted) */}
            <button
              onClick={handleLostDeal}
              disabled={!canLostDeal || saving}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
                canLostDeal
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Lost Deal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuotationEditPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
      <QuotationEditContent />
    </Suspense>
  );
}
