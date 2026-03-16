"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast, ToastContainer } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

interface SpecialPriceRow {
  id: number;
  customer_id: number;
  product_id: number;
  special_unit_price: number;
  customer_name: string;
  customer_code: string;
  product_name: string;
  standard_unit_price: number;
}

interface CustomerOption {
  id: number;
  customer_code: string;
  customer_name: string;
}

interface ProductOption {
  id: number;
  product_code: string;
  product_name: string;
  standard_unit_price: number;
}

interface FormData {
  customer_id: string;
  product_id: string;
  special_unit_price: string;
}

interface FormErrors {
  customer_id?: string;
  product_id?: string;
  special_unit_price?: string;
}

const initialForm: FormData = {
  customer_id: "",
  product_id: "",
  special_unit_price: "0",
};

export default function SpecialPriceManagementPage() {
  const [specialPrices, setSpecialPrices] = useState<SpecialPriceRow[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [filterCustomerId, setFilterCustomerId] = useState(0);
  const [filterProductId, setFilterProductId] = useState(0);
  const [targetId, setTargetId] = useState(0);
  const [form, setForm] = useState<FormData>({ ...initialForm });
  const [errors, setErrors] = useState<FormErrors>({});
  const [standardPriceRef, setStandardPriceRef] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const toast = useToast();

  const fetchSpecialPrices = useCallback(async (custId: number = 0, prodId: number = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (custId > 0) params.set("customer_id", String(custId));
      if (prodId > 0) params.set("product_id", String(prodId));
      const res = await fetch(`/api/special-prices?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setSpecialPrices(json.data);
      }
    } catch {
      toast.error("Failed to load special prices.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch("/api/customers");
      const json = await res.json();
      if (json.success) {
        setCustomers(json.data);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      const json = await res.json();
      if (json.success) {
        setProducts(json.data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchSpecialPrices();
    fetchCustomers();
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterCustomerChange = (value: number) => {
    setFilterCustomerId(value);
    fetchSpecialPrices(value, filterProductId);
  };

  const handleFilterProductChange = (value: number) => {
    setFilterProductId(value);
    fetchSpecialPrices(filterCustomerId, value);
  };

  const handleSelectRow = (row: SpecialPriceRow) => {
    setTargetId(row.id);
    setForm({
      customer_id: String(row.customer_id),
      product_id: String(row.product_id),
      special_unit_price: String(row.special_unit_price),
    });
    setStandardPriceRef(row.standard_unit_price);
    setErrors({});
  };

  const handleAddNew = () => {
    setTargetId(0);
    setForm({ ...initialForm });
    setStandardPriceRef(null);
    setErrors({});
  };

  const handleProductChange = (productIdStr: string) => {
    setForm({ ...form, product_id: productIdStr });
    if (errors.product_id) setErrors({ ...errors, product_id: undefined });

    const pid = Number(productIdStr);
    if (pid > 0) {
      const product = products.find((p) => p.id === pid);
      if (product) {
        setStandardPriceRef(product.standard_unit_price);
      } else {
        setStandardPriceRef(null);
      }
    } else {
      setStandardPriceRef(null);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.customer_id || Number(form.customer_id) < 1) {
      newErrors.customer_id = "Please select a customer.";
    }
    if (!form.product_id || Number(form.product_id) < 1) {
      newErrors.product_id = "Please select a product.";
    }
    const price = Number(form.special_unit_price);
    if (isNaN(price) || price < 0 || price > 9999999) {
      newErrors.special_unit_price = "Please enter a special unit price between ¥0 and ¥9,999,999.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      let res: Response;
      if (targetId === 0) {
        // New creation
        res = await fetch("/api/special-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_id: Number(form.customer_id),
            product_id: Number(form.product_id),
            special_unit_price: Number(form.special_unit_price),
          }),
        });
      } else {
        // Update - only special_unit_price
        res = await fetch(`/api/special-prices/${targetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            special_unit_price: Number(form.special_unit_price),
          }),
        });
      }

      const json = await res.json();
      if (json.success) {
        toast.success(targetId === 0 ? "Special price created." : "Special price updated.");
        setTargetId(0);
        setForm({ ...initialForm });
        setStandardPriceRef(null);
        setErrors({});
        fetchSpecialPrices(filterCustomerId, filterProductId);
      } else {
        toast.error(json.error || "Save failed.");
      }
    } catch {
      toast.error("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = () => {
    if (targetId === 0) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/special-prices/${targetId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Special price deleted.");
        setTargetId(0);
        setForm({ ...initialForm });
        setStandardPriceRef(null);
        setErrors({});
        fetchSpecialPrices(filterCustomerId, filterProductId);
      } else {
        toast.error(json.error || "Delete failed.");
      }
    } catch {
      toast.error("Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const formatPrice = (price: number) => {
    return `¥${price.toLocaleString()}`;
  };

  return (
    <div>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Special Price"
        message="Are you sure you want to delete this special unit price? After deletion, the standard unit price will be applied at the time of order."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Special Price Master</h1>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Filter</label>
            <select
              value={filterCustomerId}
              onChange={(e) => handleFilterCustomerChange(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_code} - {c.customer_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Filter</label>
            <select
              value={filterProductId}
              onChange={(e) => handleFilterProductChange(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product_code} - {p.product_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left: Special Price List */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-lg shadow">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Customer Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Product Name</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Special Unit Price</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-400">Standard Unit Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specialPrices.map((sp) => (
                      <tr
                        key={sp.id}
                        onClick={() => handleSelectRow(sp)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${
                          targetId === sp.id ? "bg-blue-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-3">{sp.customer_name}</td>
                        <td className="px-4 py-3">{sp.product_name}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatPrice(sp.special_unit_price)}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{formatPrice(sp.standard_unit_price)}</td>
                      </tr>
                    ))}
                    {specialPrices.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          No special prices found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right: Edit Form */}
        <div className="w-96 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {targetId === 0 ? "New Special Price" : "Edit Special Price"}
              </h2>
              <button
                onClick={handleAddNew}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Add New
              </button>
            </div>

            <div className="space-y-4">
              {/* Customer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.customer_id}
                  onChange={(e) => {
                    setForm({ ...form, customer_id: e.target.value });
                    if (errors.customer_id) setErrors({ ...errors, customer_id: undefined });
                  }}
                  disabled={targetId > 0}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.customer_id ? "border-red-500" : "border-gray-300"
                  } ${targetId > 0 ? "bg-gray-100 cursor-not-allowed" : ""}`}
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_code} - {c.customer_name}
                    </option>
                  ))}
                </select>
                {errors.customer_id && (
                  <p className="mt-1 text-xs text-red-600">{errors.customer_id}</p>
                )}
              </div>

              {/* Product */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.product_id}
                  onChange={(e) => handleProductChange(e.target.value)}
                  disabled={targetId > 0}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.product_id ? "border-red-500" : "border-gray-300"
                  } ${targetId > 0 ? "bg-gray-100 cursor-not-allowed" : ""}`}
                >
                  <option value="">-- Select Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.product_code} - {p.product_name}
                    </option>
                  ))}
                </select>
                {errors.product_id && (
                  <p className="mt-1 text-xs text-red-600">{errors.product_id}</p>
                )}
              </div>

              {/* Standard Price Reference */}
              {standardPriceRef !== null && (
                <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  <span className="text-sm text-gray-500">Standard Unit Price: </span>
                  <span className="text-sm font-medium text-gray-700">{formatPrice(standardPriceRef)}</span>
                </div>
              )}

              {/* Special Unit Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special Unit Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¥</span>
                  <input
                    type="number"
                    min="0"
                    max="9999999"
                    value={form.special_unit_price}
                    onChange={(e) => {
                      setForm({ ...form, special_unit_price: e.target.value });
                      if (errors.special_unit_price) setErrors({ ...errors, special_unit_price: undefined });
                    }}
                    className={`w-full pl-7 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.special_unit_price ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                </div>
                {errors.special_unit_price && (
                  <p className="mt-1 text-xs text-red-600">{errors.special_unit_price}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                  {saving ? "Saving..." : "Save"}
                </button>

                {targetId > 0 && (
                  <button
                    onClick={handleDeleteClick}
                    disabled={deleting}
                    className="w-full px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:bg-red-300 transition-colors"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
