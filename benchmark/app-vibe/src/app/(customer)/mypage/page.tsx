"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ReservationMenuDetail {
  menu_id: number;
  menu_name: string;
  price_at_booking: number;
  duration_at_booking: number;
}

interface Reservation {
  reservation_id: number;
  customer_id: number;
  staff_id: number;
  staff_name: string;
  is_nominated: number;
  start_datetime: string;
  total_duration: number;
  status: number;
  menus: ReservationMenuDetail[];
}

interface Favorite {
  target_type: number;
  target_id: number;
  target_name: string;
}

const STATUS_LABELS: Record<number, string> = {
  0: "Confirmed",
  1: "Cancelled",
  2: "Checked In",
  3: "Completed",
  4: "No-Show",
};

const CUSTOMER_ID = 1; // simulated logged-in user

export default function MyPage() {
  const router = useRouter();
  const [upcoming, setUpcoming] = useState<Reservation[]>([]);
  const [past, setPast] = useState<Reservation[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [cancelPreview, setCancelPreview] = useState<{
    cancellation_fee_rate: number;
    cancellation_fee: number;
    total_price: number;
    hours_before: number;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchReservations();
    fetchFavorites();
  }, []);

  async function fetchReservations() {
    const res = await fetch(`/api/reservations?customer_id=${CUSTOMER_ID}`);
    const data = await res.json();
    const now = new Date().toISOString();
    setUpcoming(
      data
        .filter((r: Reservation) => r.start_datetime >= now)
        .sort((a: Reservation, b: Reservation) => a.start_datetime.localeCompare(b.start_datetime))
        .slice(0, 20)
    );
    setPast(
      data
        .filter((r: Reservation) => r.start_datetime < now)
        .sort((a: Reservation, b: Reservation) => b.start_datetime.localeCompare(a.start_datetime))
        .slice(0, 50)
    );
  }

  async function fetchFavorites() {
    const res = await fetch(`/api/favorites?customer_id=${CUSTOMER_ID}`);
    const data = await res.json();
    setFavorites(data);
  }

  async function openCancelDialog(reservationId: number) {
    setError("");
    setCancelTarget(reservationId);
    setCancelPreview(null);
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_preview" }),
      });
      if (res.ok) {
        const data = await res.json();
        setCancelPreview(data);
      }
    } catch {
      // Preview fetch failed, dialog will show without fee details
    }
  }

  async function handleCancel(reservationId: number) {
    setError("");
    const res = await fetch(`/api/reservations/${reservationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to cancel");
    }
    setCancelTarget(null);
    setCancelPreview(null);
    fetchReservations();
  }

  function handleModify(reservation: Reservation) {
    const menuIds = reservation.menus.map(m => m.menu_id).join(",");
    const staffParam = reservation.is_nominated ? reservation.staff_id : 0;
    const dateStr = reservation.start_datetime.split(" ")[0] || reservation.start_datetime.split("T")[0];
    router.push(`/reserve?menus=${menuIds}&staff=${staffParam}&date=${dateStr}&mod=${reservation.reservation_id}`);
  }

  function handleRebook(reservation: Reservation) {
    const menuIds = reservation.menus.map(m => m.menu_id).join(",");
    const staffParam = reservation.is_nominated ? reservation.staff_id : 0;
    router.push(`/reserve?menus=${menuIds}&staff=${staffParam}`);
  }

  async function toggleFavorite(targetType: number, targetId: number) {
    await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: CUSTOMER_ID, target_type: targetType, target_id: targetId }),
    });
    fetchFavorites();
  }

  function formatDateTime(dt: string) {
    return dt.replace("T", " ").slice(0, 16);
  }

  function totalPrice(menus: ReservationMenuDetail[]) {
    return menus.reduce((sum, m) => sum + m.price_at_booking, 0);
  }

  const favoriteStaff = favorites.filter(f => f.target_type === 0);
  const favoriteMenus = favorites.filter(f => f.target_type === 1);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Page</h1>

      {error && <p className="text-red-500 text-sm mb-4 bg-red-50 p-2 rounded">{error}</p>}

      {/* Upcoming Reservations */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Upcoming Reservations</h2>
        {upcoming.length === 0 && <p className="text-gray-400 text-sm">No upcoming reservations.</p>}
        <div className="space-y-3">
          {upcoming.map(r => (
            <div key={r.reservation_id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{formatDateTime(r.start_datetime)}</p>
                  <p className="text-sm text-gray-600">Staff: {r.staff_name}</p>
                  <p className="text-sm text-gray-600">Menus: {r.menus.map(m => m.menu_name).join(", ")}</p>
                  <p className="text-sm text-gray-600">Total: ¥{totalPrice(r.menus).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    r.status === 0 ? "bg-green-100 text-green-700" :
                    r.status === 1 ? "bg-gray-100 text-gray-500" :
                    r.status === 2 ? "bg-blue-100 text-blue-700" : "bg-gray-100"
                  }`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                  {r.status === 0 && (
                    <div className="mt-2 flex gap-2 text-sm">
                      <button
                        onClick={() => openCancelDialog(r.reservation_id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleModify(r)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        Modify
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Past Reservations */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Past Reservations</h2>
        {past.length === 0 && <p className="text-gray-400 text-sm">No past reservations.</p>}
        <div className="space-y-3">
          {past.map(r => (
            <div key={r.reservation_id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{formatDateTime(r.start_datetime)}</p>
                  <p className="text-sm text-gray-600">Staff: {r.staff_name}</p>
                  <p className="text-sm text-gray-600">Menus: {r.menus.map(m => m.menu_name).join(", ")}</p>
                  <p className="text-sm text-gray-600">Total: ¥{totalPrice(r.menus).toLocaleString()}</p>
                  <span className="text-xs text-gray-400">{STATUS_LABELS[r.status]}</span>
                </div>
                <button
                  onClick={() => handleRebook(r)}
                  className="text-sm text-blue-500 hover:text-blue-700"
                >
                  Re-book
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Favorites */}
      <section className="mb-8 grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">Favorite Staff</h2>
          {favoriteStaff.length === 0 && <p className="text-gray-400 text-sm">No favorite staff.</p>}
          {favoriteStaff.map(f => (
            <div key={f.target_id} className="flex items-center justify-between bg-white border rounded p-2 mb-2">
              <span className="text-sm">{f.target_name}</span>
              <button onClick={() => toggleFavorite(0, f.target_id)} className="text-red-400 hover:text-red-600 text-xs">
                Remove
              </button>
            </div>
          ))}
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-3">Favorite Menus</h2>
          {favoriteMenus.length === 0 && <p className="text-gray-400 text-sm">No favorite menus.</p>}
          {favoriteMenus.map(f => (
            <div key={f.target_id} className="flex items-center justify-between bg-white border rounded p-2 mb-2">
              <span className="text-sm">{f.target_name}</span>
              <button onClick={() => toggleFavorite(1, f.target_id)} className="text-red-400 hover:text-red-600 text-xs">
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Cancel Confirmation Dialog */}
      {cancelTarget !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h3 className="font-bold mb-4">Cancel Reservation?</h3>

            {cancelPreview ? (
              <div className="mb-4">
                {cancelPreview.cancellation_fee_rate === 0 ? (
                  <p className="text-sm text-green-700 bg-green-50 p-3 rounded">
                    No cancellation fee applies (more than 72 hours before the appointment).
                  </p>
                ) : (
                  <div className="text-sm bg-red-50 p-3 rounded space-y-1">
                    <p className="text-red-700 font-medium">
                      Cancellation fee: {cancelPreview.cancellation_fee_rate}% (¥{cancelPreview.cancellation_fee.toLocaleString()})
                    </p>
                    <p className="text-gray-600">
                      Service total: ¥{cancelPreview.total_price.toLocaleString()}
                    </p>
                  </div>
                )}
                <div className="mt-3 text-xs text-gray-500 space-y-0.5">
                  <p>Cancellation policy:</p>
                  <ul className="ml-3 list-disc">
                    <li>72+ hours before: Free</li>
                    <li>24-72 hours before: 50% fee</li>
                    <li>Less than 24 hours: 100% fee</li>
                    <li>No-show: 100% fee</li>
                    <li>Modification (rebooking): No fee</li>
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 mb-4">Loading cancellation fee information...</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setCancelTarget(null); setCancelPreview(null); }}
                className="flex-1 py-2 border rounded-md text-sm hover:bg-gray-50"
              >
                Keep
              </button>
              <button
                onClick={() => handleCancel(cancelTarget)}
                className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-500"
              >
                Cancel Reservation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
