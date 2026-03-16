"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast, ToastContainer } from "@/components/Toast";

interface ProductWithCategory {
  id: number;
  product_code: string;
  product_name: string;
  category_id: number;
  standard_unit_price: number;
  unit: string;
  active: number;
  category_name: string | null;
}

interface Category {
  id: number;
  category_name: string;
}

interface FormData {
  product_code: string;
  product_name: string;
  category_id: number;
  standard_unit_price: string;
  unit: string;
  active: number;
}

interface FormErrors {
  product_code?: string;
  product_name?: string;
  standard_unit_price?: string;
}

const initialForm: FormData = {
  product_code: "",
  product_name: "",
  category_id: 0,
  standard_unit_price: "0",
  unit: "個",
  active: 1,
};

export default function ProductManagementPage() {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchText, setSearchText] = useState("");
  const [targetProductId, setTargetProductId] = useState(0);
  const [form, setForm] = useState<FormData>({ ...initialForm });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchProducts = useCallback(async (search: string = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/products?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setProducts(json.data);
      }
    } catch {
      toast.error("Failed to load products.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      const json = await res.json();
      if (json.success) {
        setCategories(json.data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    fetchProducts(searchText);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSelectProduct = (product: ProductWithCategory) => {
    setTargetProductId(product.id);
    setForm({
      product_code: product.product_code,
      product_name: product.product_name,
      category_id: product.category_id,
      standard_unit_price: String(product.standard_unit_price),
      unit: product.unit,
      active: product.active,
    });
    setErrors({});
  };

  const handleAddNew = () => {
    setTargetProductId(0);
    setForm({ ...initialForm });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.product_code.trim()) {
      newErrors.product_code = "Please enter the product code.";
    }
    if (!form.product_name.trim()) {
      newErrors.product_name = "Please enter the product name.";
    }
    const price = Number(form.standard_unit_price);
    if (isNaN(price) || price < 0 || price > 9999999) {
      newErrors.standard_unit_price = "Please enter a standard unit price between ¥0 and ¥9,999,999.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        product_code: form.product_code.trim(),
        product_name: form.product_name.trim(),
        category_id: form.category_id,
        standard_unit_price: Number(form.standard_unit_price),
        unit: form.unit || "個",
        active: form.active,
      };

      let res: Response;
      if (targetProductId === 0) {
        res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/products/${targetProductId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (json.success) {
        toast.success(targetProductId === 0 ? "Product created." : "Product updated.");
        setTargetProductId(0);
        setForm({ ...initialForm });
        setErrors({});
        fetchProducts(searchText);
      } else {
        // Check for field-specific errors
        if (json.error?.includes("code")) {
          setErrors({ product_code: json.error });
        } else {
          toast.error(json.error || "Save failed.");
        }
      }
    } catch {
      toast.error("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (price: number) => {
    return `¥${price.toLocaleString()}`;
  };

  return (
    <div>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Product Management</h1>

      <div className="flex gap-6">
        {/* Left: Product List */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-lg shadow">
            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search by product code or name..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Product Code</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Product Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Standard Unit Price</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Unit</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr
                        key={product.id}
                        onClick={() => handleSelectProduct(product)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${
                          targetProductId === product.id
                            ? "bg-blue-50"
                            : product.active === 0
                            ? "bg-gray-100 text-gray-400"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className={`px-4 py-3 font-mono ${product.active === 0 ? "text-gray-400" : ""}`}>
                          {product.product_code}
                        </td>
                        <td className={`px-4 py-3 ${product.active === 0 ? "text-gray-400" : ""}`}>
                          {product.product_name}
                        </td>
                        <td className={`px-4 py-3 ${product.active === 0 ? "text-gray-400" : ""}`}>
                          {product.category_id === 0 ? "Uncategorized" : (product.category_name || "Uncategorized")}
                        </td>
                        <td className={`px-4 py-3 text-right ${product.active === 0 ? "text-gray-400" : ""}`}>
                          {formatPrice(product.standard_unit_price)}
                        </td>
                        <td className={`px-4 py-3 ${product.active === 0 ? "text-gray-400" : ""}`}>
                          {product.unit}
                        </td>
                        <td className={`px-4 py-3 text-center ${product.active === 0 ? "text-gray-400" : ""}`}>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              product.active === 1
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-200 text-gray-500"
                            }`}
                          >
                            {product.active === 1 ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {products.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No products found.
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
                {targetProductId === 0 ? "New Product" : "Edit Product"}
              </h2>
              <button
                onClick={handleAddNew}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Add New
              </button>
            </div>

            <div className="space-y-4">
              {/* Product Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.product_code}
                  onChange={(e) => {
                    setForm({ ...form, product_code: e.target.value });
                    if (errors.product_code) setErrors({ ...errors, product_code: undefined });
                  }}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.product_code ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="e.g., PRD-011"
                />
                {errors.product_code && (
                  <p className="mt-1 text-xs text-red-600">{errors.product_code}</p>
                )}
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.product_name}
                  onChange={(e) => {
                    setForm({ ...form, product_name: e.target.value });
                    if (errors.product_name) setErrors({ ...errors, product_name: undefined });
                  }}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.product_name ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Product name"
                />
                {errors.product_name && (
                  <p className="mt-1 text-xs text-red-600">{errors.product_name}</p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>Uncategorized</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Standard Unit Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Standard Unit Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¥</span>
                  <input
                    type="number"
                    min="0"
                    max="9999999"
                    value={form.standard_unit_price}
                    onChange={(e) => {
                      setForm({ ...form, standard_unit_price: e.target.value });
                      if (errors.standard_unit_price) setErrors({ ...errors, standard_unit_price: undefined });
                    }}
                    className={`w-full pl-7 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.standard_unit_price ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                </div>
                {errors.standard_unit_price && (
                  <p className="mt-1 text-xs text-red-600">{errors.standard_unit_price}</p>
                )}
              </div>

              {/* Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., piece, box, kg"
                />
              </div>

              {/* Active Flag */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, active: form.active === 1 ? 0 : 1 })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.active === 1 ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.active === 1 ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="ml-3 text-sm text-gray-600">
                  {form.active === 1 ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
