"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast, ToastContainer } from "@/components/Toast";

interface CustomerRow {
  id: number;
  customer_code: string;
  customer_name: string;
  address: string;
  phone: string;
  email: string;
  closing_day: number;
  credit_limit: number;
}

interface FormData {
  customer_code: string;
  customer_name: string;
  address: string;
  phone: string;
  email: string;
  closing_day: string;
  credit_limit: string;
}

interface FormErrors {
  customer_code?: string;
  customer_name?: string;
  closing_day?: string;
  credit_limit?: string;
}

const initialForm: FormData = {
  customer_code: "",
  customer_name: "",
  address: "",
  phone: "",
  email: "",
  closing_day: "0",
  credit_limit: "0",
};

export default function CustomerManagementPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [searchText, setSearchText] = useState("");
  const [targetCustomerId, setTargetCustomerId] = useState(0);
  const [form, setForm] = useState<FormData>({ ...initialForm });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchCustomers = useCallback(async (search: string = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/customers?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setCustomers(json.data);
      }
    } catch {
      toast.error("Failed to load customers.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    fetchCustomers(searchText);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSelectCustomer = (customer: CustomerRow) => {
    setTargetCustomerId(customer.id);
    setForm({
      customer_code: customer.customer_code,
      customer_name: customer.customer_name,
      address: customer.address,
      phone: customer.phone,
      email: customer.email,
      closing_day: String(customer.closing_day),
      credit_limit: String(customer.credit_limit),
    });
    setErrors({});
  };

  const handleAddNew = () => {
    setTargetCustomerId(0);
    setForm({ ...initialForm });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.customer_code.trim()) {
      newErrors.customer_code = "Please enter the customer code.";
    }
    if (!form.customer_name.trim()) {
      newErrors.customer_name = "Please enter the customer name.";
    }
    const limit = Number(form.credit_limit);
    if (isNaN(limit) || limit < 0 || limit > 99999999) {
      newErrors.credit_limit = "Please enter a credit limit between ¥0 and ¥99,999,999.";
    }
    const day = Number(form.closing_day);
    if (isNaN(day) || !Number.isInteger(day) || (day !== 0 && (day < 1 || day > 28))) {
      newErrors.closing_day = "Please enter 0 (end of month) or an integer between 1 and 28 for the closing day.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        customer_code: form.customer_code.trim(),
        customer_name: form.customer_name.trim(),
        address: form.address,
        phone: form.phone,
        email: form.email,
        closing_day: Number(form.closing_day),
        credit_limit: Number(form.credit_limit),
      };

      let res: Response;
      if (targetCustomerId === 0) {
        res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/customers/${targetCustomerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (json.success) {
        toast.success(targetCustomerId === 0 ? "Customer created." : "Customer updated.");
        setTargetCustomerId(0);
        setForm({ ...initialForm });
        setErrors({});
        fetchCustomers(searchText);
      } else {
        if (json.error?.includes("code")) {
          setErrors({ customer_code: json.error });
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

  const formatClosingDay = (day: number) => {
    return day === 0 ? "End of Month" : `Day ${day}`;
  };

  const formatCreditLimit = (limit: number) => {
    return limit === 0 ? "No Check" : `¥${limit.toLocaleString()}`;
  };

  return (
    <div>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Customer Management</h1>

      <div className="flex gap-6">
        {/* Left: Customer List */}
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
                  placeholder="Search by customer code or name..."
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
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Customer Code</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Customer Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Address</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Closing Day</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Credit Limit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        onClick={() => handleSelectCustomer(customer)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${
                          targetCustomerId === customer.id ? "bg-blue-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-3 font-mono">{customer.customer_code}</td>
                        <td className="px-4 py-3">{customer.customer_name}</td>
                        <td className="px-4 py-3 truncate max-w-[200px]">{customer.address}</td>
                        <td className="px-4 py-3">{customer.phone}</td>
                        <td className="px-4 py-3 text-center">{formatClosingDay(customer.closing_day)}</td>
                        <td className="px-4 py-3 text-right">{formatCreditLimit(customer.credit_limit)}</td>
                      </tr>
                    ))}
                    {customers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No customers found.
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
                {targetCustomerId === 0 ? "New Customer" : "Edit Customer"}
              </h2>
              <button
                onClick={handleAddNew}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Add New
              </button>
            </div>

            <div className="space-y-4">
              {/* Customer Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.customer_code}
                  onChange={(e) => {
                    setForm({ ...form, customer_code: e.target.value });
                    if (errors.customer_code) setErrors({ ...errors, customer_code: undefined });
                  }}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.customer_code ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="e.g., CUS-006"
                />
                {errors.customer_code && (
                  <p className="mt-1 text-xs text-red-600">{errors.customer_code}</p>
                )}
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={(e) => {
                    setForm({ ...form, customer_name: e.target.value });
                    if (errors.customer_name) setErrors({ ...errors, customer_name: undefined });
                  }}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.customer_name ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Customer name"
                />
                {errors.customer_name && (
                  <p className="mt-1 text-xs text-red-600">{errors.customer_name}</p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Address"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Phone number"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Email address"
                />
              </div>

              {/* Closing Day */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Closing Day</label>
                <input
                  type="number"
                  min="0"
                  max="28"
                  value={form.closing_day}
                  onChange={(e) => {
                    setForm({ ...form, closing_day: e.target.value });
                    if (errors.closing_day) setErrors({ ...errors, closing_day: undefined });
                  }}
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.closing_day ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="0 = End of Month, 1-28"
                />
                {errors.closing_day && (
                  <p className="mt-1 text-xs text-red-600">{errors.closing_day}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">0 = End of Month, 1-28 = specific day</p>
              </div>

              {/* Credit Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">¥</span>
                  <input
                    type="number"
                    min="0"
                    max="99999999"
                    value={form.credit_limit}
                    onChange={(e) => {
                      setForm({ ...form, credit_limit: e.target.value });
                      if (errors.credit_limit) setErrors({ ...errors, credit_limit: undefined });
                    }}
                    className={`w-full pl-7 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.credit_limit ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                </div>
                {errors.credit_limit && (
                  <p className="mt-1 text-xs text-red-600">{errors.credit_limit}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">0 = No credit check</p>
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
