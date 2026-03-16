"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface ToastMessage {
  id: string;
  type: "success" | "error";
  message: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (type: "success" | "error", message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, message }]);

      const timer = setTimeout(() => {
        removeToast(id);
      }, 3000);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string) => addToast("success", message),
    [addToast]
  );

  const error = useCallback(
    (message: string) => addToast("error", message),
    [addToast]
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    const currentTimers = timersRef.current;
    return () => {
      currentTimers.forEach((timer) => clearTimeout(timer));
      currentTimers.clear();
    };
  }, []);

  return { toasts, success, error, removeToast };
}

export function ToastContainer({ toasts, onRemove }: { toasts: ToastMessage[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const bgColor = toast.type === "success" ? "bg-green-600" : "bg-red-600";

  return (
    <div
      className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-3 animate-slide-in`}
      role="alert"
    >
      <div className="flex items-center gap-2">
        {toast.type === "success" ? (
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-white/80 hover:text-white flex-shrink-0"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
