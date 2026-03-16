"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useToast, ToastContainer } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

interface InstructionItem {
  id: number;
  shipping_instruction_id: number;
  order_item_id: number;
  product_id: number;
  instructed_quantity: number;
  shipped_quantity: number;
  product_name: string;
  product_code: string;
}

interface ShippingRecordRow {
  id: number;
  shipping_instruction_item_id: number;
  shipped_quantity: number;
  shipped_at: string;
}

interface InstructionDetail {
  id: number;
  shipping_instruction_number: string;
  order_id: number;
  customer_id: number;
  status: number;
  created_at: string;
  customer_name: string;
  order_number: string;
  items: InstructionItem[];
  shipping_records: ShippingRecordRow[];
  inventory: Record<number, number>;
}

const STATUS_LABELS: Record<number, string> = {
  0: "Not Shipped",
  1: "Shipping",
  2: "Shipped",
  3: "Cancelled",
};

const STATUS_BADGE_CLASSES: Record<number, string> = {
  0: "bg-yellow-100 text-yellow-800",
  1: "bg-blue-100 text-blue-800",
  2: "bg-green-100 text-green-800",
  3: "bg-red-100 text-red-800",
};

export default function ShippingWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const instructionId = parseInt(resolvedParams.id, 10);

  const [instruction, setInstruction] = useState<InstructionDetail | null>(null);
  const [shipQuantities, setShipQuantities] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const fetchInstruction = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shipping-instructions/${instructionId}`);
      const json = await res.json();
      if (json.success) {
        setInstruction(json.data);
        // Initialize ship quantities to 0 for all items
        const initialQuantities: Record<number, number> = {};
        for (const item of json.data.items) {
          initialQuantities[item.id] = 0;
        }
        setShipQuantities(initialQuantities);
      } else {
        toast.error(json.error || "Failed to load shipping instruction");
        // If guard condition fails, navigate back
        if (res.status === 400) {
          router.push("/shipping");
        }
      }
    } catch {
      toast.error("Failed to load shipping instruction");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructionId]);

  useEffect(() => {
    fetchInstruction();
  }, [fetchInstruction]);

  const handleQuantityChange = (itemId: number, value: string) => {
    const qty = parseInt(value, 10);
    setShipQuantities((prev) => ({
      ...prev,
      [itemId]: isNaN(qty) ? 0 : Math.max(0, qty),
    }));
  };

  const hasAnyQuantity = Object.values(shipQuantities).some((q) => q > 0);

  const handleConfirmShipment = async () => {
    setConfirmDialogOpen(false);
    if (!instruction) return;

    setSubmitting(true);
    try {
      const items = instruction.items.map((item) => ({
        shipping_instruction_item_id: item.id,
        quantity: shipQuantities[item.id] || 0,
      }));

      const res = await fetch(`/api/shipping-instructions/${instructionId}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Shipment processed successfully.");
        // Navigate back to the shipping list
        setTimeout(() => {
          router.push("/shipping");
        }, 1000);
      } else {
        // Display validation errors
        toast.error(json.error || "Shipment failed.");
      }
    } catch {
      toast.error("Failed to process shipment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setCancelDialogOpen(false);
    if (!instruction) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/shipping-instructions/${instructionId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Shipping instruction cancelled.");
        setTimeout(() => {
          router.push("/shipping");
        }, 1000);
      } else {
        toast.error(json.error || "Failed to cancel.");
      }
    } catch {
      toast.error("Failed to cancel shipping instruction");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">Loading...</div>
    );
  }

  if (!instruction) {
    return (
      <div className="p-8 text-center text-gray-500">
        Shipping instruction not found.
        <button
          onClick={() => router.push("/shipping")}
          className="ml-4 text-blue-600 hover:underline"
        >
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      <ConfirmDialog
        open={cancelDialogOpen}
        title="Cancel Shipping Instruction"
        message={`Are you sure you want to cancel shipping instruction ${instruction.shipping_instruction_number}? Allocated stock will be restored.`}
        confirmLabel="Cancel Instruction"
        cancelLabel="Go Back"
        destructive
        onConfirm={handleCancel}
        onCancel={() => setCancelDialogOpen(false)}
      />

      <ConfirmDialog
        open={confirmDialogOpen}
        title="Confirm Shipment"
        message="Are you sure you want to confirm this shipment? Stock will be decremented."
        confirmLabel="Confirm Shipment"
        cancelLabel="Go Back"
        onConfirm={handleConfirmShipment}
        onCancel={() => setConfirmDialogOpen(false)}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push("/shipping")}
            className="text-sm text-blue-600 hover:underline mb-2 inline-block"
          >
            &larr; Back to Shipping Instructions
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Shipping Work</h1>
        </div>
      </div>

      {/* Instruction Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Instruction No.</div>
            <div className="font-mono font-semibold text-gray-900">
              {instruction.shipping_instruction_number}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Order No.</div>
            <div className="font-mono text-gray-900">{instruction.order_number}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Customer</div>
            <div className="text-gray-900">{instruction.customer_name}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Status</div>
            <span
              className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                STATUS_BADGE_CLASSES[instruction.status] || "bg-gray-100 text-gray-800"
              }`}
            >
              {STATUS_LABELS[instruction.status] || `Status ${instruction.status}`}
            </span>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">Shipping Line Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Instructed</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Shipped</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Remaining</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Physical Stock</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Ship This Time</th>
            </tr>
          </thead>
          <tbody>
            {instruction.items.map((item) => {
              const remaining = item.instructed_quantity - item.shipped_quantity;
              const physicalStock = instruction.inventory[item.product_id] ?? 0;
              const isComplete = remaining === 0;
              return (
                <tr
                  key={item.id}
                  className={`border-b border-gray-100 ${isComplete ? "bg-gray-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{item.product_name}</div>
                    <div className="text-xs text-gray-500 font-mono">{item.product_code}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {item.instructed_quantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {item.shipped_quantity.toLocaleString()}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      remaining > 0 ? "text-orange-600" : "text-green-600"
                    }`}
                  >
                    {remaining.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {physicalStock.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isComplete ? (
                      <span className="text-xs text-green-600 font-medium">Complete</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={remaining}
                        value={shipQuantities[item.id] || 0}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        className="w-24 px-3 py-1 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={submitting}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Shipping Records History */}
      {instruction.shipping_records.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">Shipping Records History</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Quantity</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Shipped At</th>
              </tr>
            </thead>
            <tbody>
              {instruction.shipping_records.map((record) => {
                // Find the corresponding item
                const item = instruction.items.find(
                  (i) => i.id === record.shipping_instruction_item_id
                );
                return (
                  <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">
                      {item?.product_name || `Item #${record.shipping_instruction_item_id}`}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {record.shipped_quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDateTime(record.shipped_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div>
          {instruction.status === 0 && (
            <button
              onClick={() => setCancelDialogOpen(true)}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Cancel Instruction
            </button>
          )}
        </div>
        <button
          onClick={() => setConfirmDialogOpen(true)}
          disabled={!hasAnyQuantity || submitting}
          className={`px-6 py-2 text-sm font-medium text-white rounded-md transition-colors ${
            hasAnyQuantity && !submitting
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-300 cursor-not-allowed"
          }`}
        >
          {submitting ? "Processing..." : "Confirm Shipment"}
        </button>
      </div>
    </div>
  );
}
