"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast, ToastContainer } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

interface UnreconciledPayment {
  id: number;
  customer_id: number;
  customer_name: string;
  payment_amount: number;
  payment_date: string;
  payment_method: number;
  reconciliation_status: number;
  unreconciled_balance: number;
}

interface UnreconciledInvoice {
  id: number;
  invoice_number: string;
  invoice_amount: number;
  billing_period: string;
  status: number;
  issue_date: string;
  total_reconciled: number;
  unreconciled_balance: number;
}

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

export default function PaymentReconcilePage() {
  const router = useRouter();
  const { toasts, success: showSuccess, error: showError, removeToast } = useToast();

  // §2-8 Screen state
  const [payments, setPayments] = useState<UnreconciledPayment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number>(0);
  const [invoices, setInvoices] = useState<UnreconciledInvoice[]>([]);
  const [reconciliationAmounts, setReconciliationAmounts] = useState<Record<number, string>>({});
  const [paymentUnreconciledBalance, setPaymentUnreconciledBalance] = useState<number>(0);

  const [loadingPayments, setLoadingPayments] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // §3-8: Load unreconciled payments
  useEffect(() => {
    setLoadingPayments(true);
    fetch("/api/payments/unreconciled")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setPayments(json.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPayments(false));
  }, []);

  // §3-9: Load unreconciled invoices when payment is selected
  const loadInvoices = useCallback(
    async (paymentId: number) => {
      if (paymentId === 0) {
        setInvoices([]);
        setPaymentUnreconciledBalance(0);
        return;
      }

      setLoadingInvoices(true);
      try {
        const res = await fetch(`/api/payments/${paymentId}/invoices`);
        const json = await res.json();

        if (json.success) {
          setInvoices(json.data.invoices);
          setPaymentUnreconciledBalance(json.data.payment_unreconciled_balance);
        } else {
          showError(json.error || "Failed to load invoices");
        }
      } catch {
        showError("Failed to load invoices");
      } finally {
        setLoadingInvoices(false);
      }
    },
    [showError]
  );

  // §2-9: On payment selection
  const handlePaymentSelect = (paymentId: number) => {
    setSelectedPaymentId(paymentId);
    setReconciliationAmounts({}); // Clear previous inputs
    loadInvoices(paymentId);
  };

  // Handle reconciliation amount input
  const handleAmountChange = (invoiceId: number, value: string) => {
    setReconciliationAmounts((prev) => ({
      ...prev,
      [invoiceId]: value,
    }));
  };

  // Calculate current reconciliation total
  const reconciliationTotal = Object.values(reconciliationAmounts).reduce(
    (sum, val) => sum + (parseInt(val, 10) || 0),
    0
  );

  // Balance after reconciliation
  const balanceAfterReconciliation = paymentUnreconciledBalance - reconciliationTotal;

  // §2-10, §3-11: Execute Reconciliation
  const handleReconcile = () => {
    // §2-10 Guard: payment must be selected
    if (selectedPaymentId === 0) {
      return;
    }

    // Collect valid entries
    const entries = invoices
      .map((inv) => ({
        invoice_id: inv.id,
        amount: parseInt(reconciliationAmounts[inv.id] || "0", 10) || 0,
      }))
      .filter((e) => e.amount >= 1);

    // §2-10 Validation: at least 1 reconciliation amount >= 1
    if (entries.length === 0) {
      showError("Please enter at least one reconciliation amount.");
      return;
    }

    // §2-10 Validation: total must not exceed payment's unreconciled balance
    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    if (total > paymentUnreconciledBalance) {
      showError(
        `The reconciliation total exceeds the unreconciled balance of the payment (${formatCurrency(paymentUnreconciledBalance)}).`
      );
      return;
    }

    // §2-10 Validation: each amount must not exceed invoice's unreconciled balance
    for (const entry of entries) {
      const invoice = invoices.find((inv) => inv.id === entry.invoice_id);
      if (invoice && entry.amount > invoice.unreconciled_balance) {
        showError(
          `The reconciliation amount for Invoice No. ${invoice.invoice_number} exceeds the unreconciled balance.`
        );
        return;
      }
    }

    setConfirmOpen(true);
  };

  const executeReconciliation = async () => {
    setConfirmOpen(false);
    setProcessing(true);

    const entries = invoices
      .map((inv) => ({
        invoice_id: inv.id,
        amount: parseInt(reconciliationAmounts[inv.id] || "0", 10) || 0,
      }))
      .filter((e) => e.amount >= 1);

    try {
      const res = await fetch("/api/payment-reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: selectedPaymentId,
          reconciliation_entries: entries,
        }),
      });
      const json = await res.json();

      if (json.success) {
        showSuccess(json.message || "Reconciliation has been completed.");
        setTimeout(() => router.push("/invoices"), 1000);
      } else {
        showError(json.error || "Failed to process reconciliation");
      }
    } catch {
      showError("Failed to process reconciliation");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Reconciliation"
        message={`Apply reconciliation of ${formatCurrency(reconciliationTotal)} to ${
          Object.values(reconciliationAmounts).filter((v) => (parseInt(v, 10) || 0) >= 1).length
        } invoice(s)?`}
        confirmLabel="Execute Reconciliation"
        cancelLabel="Cancel"
        onConfirm={executeReconciliation}
        onCancel={() => setConfirmOpen(false)}
      />

      <h1 className="text-2xl font-bold text-gray-800 mb-6">Payment Reconciliation</h1>

      {/* Payment Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Payment
        </label>
        {loadingPayments ? (
          <div className="text-gray-500 text-sm">Loading payments...</div>
        ) : (
          <select
            value={selectedPaymentId}
            onChange={(e) => handlePaymentSelect(parseInt(e.target.value, 10))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={0}>Please select a payment</option>
            {payments.map((payment) => (
              <option key={payment.id} value={payment.id}>
                {payment.customer_name} | {payment.payment_date} | {formatCurrency(payment.payment_amount)} | Unreconciled: {formatCurrency(payment.unreconciled_balance)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Unreconciled Invoices Table */}
      {selectedPaymentId > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">
              Unreconciled Invoices
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Payment Unreconciled Balance: {formatCurrency(paymentUnreconciledBalance)}
            </p>
          </div>

          {loadingInvoices ? (
            <div className="p-8 text-center text-gray-500">Loading invoices...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No unreconciled invoices found for this customer.
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Invoice Number
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Invoice Amount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Already Reconciled
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Unreconciled Balance
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Reconciliation Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right font-mono">
                        {formatCurrency(invoice.invoice_amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right font-mono">
                        {formatCurrency(invoice.total_reconciled)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right font-mono">
                        {formatCurrency(invoice.unreconciled_balance)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          value={reconciliationAmounts[invoice.id] || ""}
                          onChange={(e) =>
                            handleAmountChange(invoice.id, e.target.value)
                          }
                          min={0}
                          max={invoice.unreconciled_balance}
                          placeholder="0"
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-end gap-8">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">
                      Current Reconciliation Total
                    </p>
                    <p className="text-lg font-bold text-gray-900 font-mono">
                      {formatCurrency(reconciliationTotal)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">
                      Payment Balance After Reconciliation
                    </p>
                    <p
                      className={`text-lg font-bold font-mono ${
                        balanceAfterReconciliation < 0
                          ? "text-red-600"
                          : "text-gray-900"
                      }`}
                    >
                      {formatCurrency(balanceAfterReconciliation)}
                    </p>
                  </div>
                </div>

                {/* Execute Button */}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleReconcile}
                    disabled={
                      selectedPaymentId === 0 ||
                      processing ||
                      reconciliationTotal === 0
                    }
                    className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {processing ? "Processing..." : "Execute Reconciliation"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
