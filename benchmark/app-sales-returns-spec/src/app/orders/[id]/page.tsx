"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useToast, ToastContainer } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

// §4-5: Order status labels
const ORDER_STATUS_LABELS: Record<number, string> = {
  0: "Confirmed",
  1: "Shipping",
  2: "Shipped",
  3: "Invoiced",
  4: "Completed",
  5: "Cancelled",
};

const ORDER_STATUS_COLORS: Record<number, string> = {
  0: "bg-blue-100 text-blue-700",
  1: "bg-yellow-100 text-yellow-700",
  2: "bg-indigo-100 text-indigo-700",
  3: "bg-purple-100 text-purple-700",
  4: "bg-green-100 text-green-700",
  5: "bg-red-100 text-red-700",
};

interface OrderDetail {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name: string;
  quotation_id: number;
  subject: string;
  status: number;
  credit_warning: number;
  ordered_at: string;
  updated_at: string;
  items: OrderItemDetail[];
  shipping_instruction: {
    id: number;
    shipping_instruction_number: string;
    status: number;
  } | null;
}

interface OrderItemDetail {
  id: number;
  order_id: number;
  product_id: number;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  shipped_quantity: number;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toasts, success: showSuccess, error: showError, removeToast } = useToast();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const taxRate = 10; // Default from system settings

  // §3-14: Load order detail
  useEffect(() => {
    const loadOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${id}`);
        const json = await res.json();
        if (json.success) {
          setOrder(json.data);
        } else {
          showError("Order not found");
          router.push("/orders");
        }
      } catch {
        showError("Failed to load order");
      } finally {
        setLoading(false);
      }
    };
    loadOrder();
  }, [id, router, showError]);

  // §3-15: Order Cancellation
  const handleCancel = () => {
    setConfirmCancel(true);
  };

  const doCancel = async () => {
    setConfirmCancel(false);
    setCancelling(true);

    try {
      const res = await fetch(`/api/orders/${id}/cancel`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        showSuccess("Order cancelled successfully.");
        // §3-15 step 7: Reload order detail
        const detailRes = await fetch(`/api/orders/${id}`);
        const detailJson = await detailRes.json();
        if (detailJson.success) {
          setOrder(detailJson.data);
        }
      } else {
        showError(json.error || "Failed to cancel order");
      }
    } catch {
      showError("Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };

  const formatCurrency = (amount: number) => `\u00a5${amount.toLocaleString()}`;

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${h}:${min}`;
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (!order) {
    return <div className="p-8 text-center text-gray-500">Order not found.</div>;
  }

  // §4-5: Calculate totals
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const taxAmount = Math.floor((subtotal * taxRate) / 100);
  const grandTotal = subtotal + taxAmount;

  // Shipping summary
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalShipped = order.items.reduce((sum, item) => sum + item.shipped_quantity, 0);

  // §4-5: Cancel button active only when status = 0 (Confirmed)
  const canCancel = order.status === 0;

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel Order"
        message="Are you sure you want to cancel this order? Stock allocation will be released."
        confirmLabel="Cancel Order"
        destructive
        onConfirm={doCancel}
        onCancel={() => setConfirmCancel(false)}
      />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Order Detail</h1>
        <button
          onClick={() => router.push("/orders")}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Back to List
        </button>
      </div>

      {/* Order Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Order Number</label>
            <p className="text-sm font-mono font-semibold">{order.order_number}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Customer</label>
            <p className="text-sm">{order.customer_name}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
            <p className="text-sm">{order.subject}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Order Date</label>
            <p className="text-sm">{formatDateTime(order.ordered_at)}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <span
              className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                ORDER_STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"
              }`}
            >
              {ORDER_STATUS_LABELS[order.status] ?? "Unknown"}
            </span>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Shipping Status</label>
            <p className="text-sm">
              Shipped {totalShipped.toLocaleString()} unit(s) / Total{" "}
              {totalQuantity.toLocaleString()} unit(s)
            </p>
          </div>
        </div>

        {/* §4-5: Credit Warning */}
        {order.credit_warning === 1 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2">
            <svg
              className="w-5 h-5 text-amber-500 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm text-amber-800">
              This order exceeds the customer&apos;s credit limit.
            </span>
          </div>
        )}
      </div>

      {/* Order Line Items */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Line Items</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-8">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Product Name</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-24">Quantity</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Unit Price</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Subtotal</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-24">Shipped</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-24">Unshipped</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => {
                const rowSubtotal = item.quantity * item.unit_price;
                const unshipped = item.quantity - item.shipped_quantity;
                return (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-gray-400">{index + 1}</td>
                    <td className="px-4 py-3">{item.product_name_snapshot}</td>
                    <td className="px-4 py-3 text-right">{item.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCurrency(rowSubtotal)}
                    </td>
                    <td className="px-4 py-3 text-right">{item.shipped_quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={unshipped > 0 ? "text-amber-600 font-medium" : "text-green-600"}>
                        {unshipped.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* §4-5: Total Amount Summary */}
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Order Amount (tax-exclusive):</span>
                <span className="font-mono font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Consumption Tax ({taxRate}%):</span>
                <span className="font-mono font-medium">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Tax-Inclusive Total:</span>
                <span className="font-mono">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex gap-3 justify-end">
          {/* §4-5: Cancel button - active only when status = 0 (Confirmed) */}
          <button
            onClick={handleCancel}
            disabled={!canCancel || cancelling}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-colors ${
              canCancel
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {cancelling ? "Processing..." : "Cancel Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
