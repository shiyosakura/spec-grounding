"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast, ToastContainer } from "@/components/Toast";

interface Customer {
  id: number;
  customer_code: string;
  customer_name: string;
}

export default function PaymentRegisterPage() {
  const router = useRouter();
  const { toasts, success: showSuccess, error: showError, removeToast } = useToast();

  // §2-6 Screen state initialization
  const [customerId, setCustomerId] = useState<number>(0);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);

  // Load customer list
  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setCustomers(json.data);
        }
      })
      .catch(() => {});
  }, []);

  // §3-7: Payment Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // §2-7 Validation
    if (customerId === 0) {
      showError("Please select a customer.");
      return;
    }

    const amount = parseInt(paymentAmount, 10);
    if (isNaN(amount) || amount < 1) {
      showError("Please enter a payment amount of at least ¥1.");
      return;
    }

    if (!paymentDate) {
      showError("Please enter the payment date.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/payments/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          payment_amount: amount,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          notes: notes,
        }),
      });
      const json = await res.json();

      if (json.success) {
        showSuccess(json.message || "Payment has been registered.");
        // §3-7 Step 2: Navigate to Invoice List Screen
        setTimeout(() => router.push("/invoices"), 1000);
      } else {
        showError(json.error || "Failed to register payment");
      }
    } catch {
      showError("Failed to register payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <h1 className="text-2xl font-bold text-gray-800 mb-6">Payment Registration</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
        <form onSubmit={handleSave}>
          {/* Customer Selection */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={0}>Please select</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_code} - {customer.customer_name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Amount */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Amount (¥) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              min={1}
              placeholder="Enter amount"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Payment Date */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Payment Method */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 0}
                  onChange={() => setPaymentMethod(0)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Bank Transfer</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === 1}
                  onChange={() => setPaymentMethod(1)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Cash</span>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Save Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
