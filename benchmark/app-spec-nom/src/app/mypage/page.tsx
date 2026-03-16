"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ReservationMenu {
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
  nomination_fee: number;
  start_datetime: string;
  total_duration: number;
  status: number;
  menus: ReservationMenu[];
}

interface Favorite {
  customer_id: number;
  target_type: number;
  target_id: number;
  target_name: string;
}

interface Customer {
  customer_id: number;
  customer_name: string;
  phone_number: string;
  cancellation_penalty_count: number;
}

interface StaffMember {
  staff_id: number;
  staff_name: string;
}

const STATUS_LABELS: Record<number, string> = {
  0: "Confirmed",
  1: "Cancelled",
  2: "Checked In",
  3: "Completed",
  4: "No-Show",
};

function MyPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [upcomingReservations, setUpcomingReservations] = useState<Reservation[]>([]);
  const [pastReservations, setPastReservations] = useState<Reservation[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [allMenus, setAllMenus] = useState<{ menu_id: number; menu_name: string }[]>([]);
  const [error, setError] = useState("");
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);

  const fetchReservations = useCallback(async (customerId: number) => {
    const res = await fetch(`/api/reservations?customer_id=${customerId}`);
    const data = await res.json();

    const now = new Date();
    const upcoming: Reservation[] = [];
    const past: Reservation[] = [];

    for (const r of data) {
      const rDate = new Date(r.start_datetime.replace(" ", "T"));
      if (rDate >= now) {
        upcoming.push(r);
      } else {
        past.push(r);
      }
    }

    upcoming.sort((a: Reservation, b: Reservation) =>
      new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
    );
    past.sort((a: Reservation, b: Reservation) =>
      new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime()
    );

    setUpcomingReservations(upcoming.slice(0, 20));
    setPastReservations(past.slice(0, 50));
  }, []);

  const fetchFavorites = useCallback(async (customerId: number) => {
    const res = await fetch(`/api/favorites?customer_id=${customerId}`);
    const data = await res.json();
    setFavorites(data);
  }, []);

  const lookupCustomer = useCallback(async (phone: string) => {
    try {
      const res = await fetch(`/api/customers?phone_number=${phone}`);
      if (!res.ok) {
        setError("Customer not found. Please make a reservation first.");
        return;
      }
      const data = await res.json();
      setCustomer(data);
      setError("");
      fetchReservations(data.customer_id);
      fetchFavorites(data.customer_id);
    } catch {
      setError("Error looking up customer.");
    }
  }, [fetchReservations, fetchFavorites]);

  useEffect(() => {
    fetch("/api/staff").then(r => r.json()).then(setStaffList);
    fetch("/api/menus").then(r => r.json()).then(setAllMenus);

    const phone = searchParams.get("phone");
    if (phone) {
      setPhoneInput(phone);
      lookupCustomer(phone);
    }
  }, [searchParams, lookupCustomer]);

  const handleLookup = () => {
    if (phoneInput.trim()) {
      lookupCustomer(phoneInput.trim());
    }
  };

  const handleCancel = async (reservationId: number) => {
    const res = await fetch(`/api/reservations/${reservationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: 1 }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setCancelConfirmId(null);
    if (customer) {
      fetchReservations(customer.customer_id);
      // Re-fetch customer to update penalty count
      lookupCustomer(customer.phone_number);
    }
  };

  const handleModify = (reservation: Reservation) => {
    const menuIds = reservation.menus.map(m => m.menu_id).join(",");
    const staffId = reservation.is_nominated === 1 ? reservation.staff_id : 0;
    const date = reservation.start_datetime.split(" ")[0] || reservation.start_datetime.split("T")[0];
    router.push(
      `/reserve?menu_ids=${menuIds}&staff_id=${staffId}&date=${date}&modification_source=${reservation.reservation_id}`
    );
  };

  const handleRebook = (reservation: Reservation) => {
    const menuIds = reservation.menus.map(m => m.menu_id).join(",");
    const staffId = reservation.is_nominated === 1 ? reservation.staff_id : 0;
    router.push(`/reserve?menu_ids=${menuIds}&staff_id=${staffId}`);
  };

  const toggleFavorite = async (targetType: number, targetId: number) => {
    if (!customer) return;
    await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customer.customer_id,
        target_type: targetType,
        target_id: targetId,
      }),
    });
    fetchFavorites(customer.customer_id);
  };

  const formatPrice = (price: number) => `¥${price.toLocaleString()}`;
  const formatDatetime = (dt: string) => {
    const d = dt.replace("T", " ");
    return d.substring(0, 16).replace("-", "/").replace("-", "/");
  };

  const isFavorite = (targetType: number, targetId: number) =>
    favorites.some(f => f.target_type === targetType && f.target_id === targetId);

  if (!customer) {
    return (
      <div className="max-w-md mx-auto p-6 mt-20">
        <h1 className="text-2xl font-bold mb-6 text-center">My Page</h1>
        <p className="text-gray-600 mb-4 text-center">Enter your phone number to access your reservations.</p>
        <div className="flex gap-2">
          <input
            type="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="flex-1 p-2 border rounded"
            placeholder="09012345678"
          />
          <button
            onClick={handleLookup}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Lookup
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        <div className="mt-6 text-center">
          <Link href="/menu" className="text-blue-600 hover:underline">Back to Menu</Link>
        </div>
      </div>
    );
  }

  const renderReservation = (r: Reservation, type: "upcoming" | "past") => {
    const totalMenuPrice = r.menus.reduce((sum, m) => sum + m.price_at_booking, 0);
    const totalWithNomination = totalMenuPrice + r.nomination_fee;

    return (
      <div key={r.reservation_id} className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium">{formatDatetime(r.start_datetime)}</p>
            <p className="text-sm text-gray-600">Staff: {r.staff_name}</p>
            <p className="text-sm text-gray-600">
              Menus: {r.menus.map(m => m.menu_name).join(", ")}
            </p>
            {r.nomination_fee > 0 && (
              <p className="text-sm text-blue-600">Nomination fee: {formatPrice(r.nomination_fee)}</p>
            )}
            <p className="text-sm font-medium">Total: {formatPrice(totalWithNomination)}</p>
          </div>
          <span
            className={`text-xs px-2 py-1 rounded ${
              r.status === 0
                ? "bg-green-100 text-green-800"
                : r.status === 1
                ? "bg-gray-100 text-gray-600"
                : r.status === 2
                ? "bg-blue-100 text-blue-800"
                : r.status === 3
                ? "bg-purple-100 text-purple-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {STATUS_LABELS[r.status]}
          </span>
        </div>

        <div className="flex gap-2 mt-3">
          {type === "upcoming" && r.status === 0 && (
            <>
              <button
                onClick={() => setCancelConfirmId(r.reservation_id)}
                className="px-3 py-1 text-sm bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleModify(r)}
                className="px-3 py-1 text-sm bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100 transition"
              >
                Modify
              </button>
            </>
          )}
          {type === "past" && (
            <button
              onClick={() => handleRebook(r)}
              className="px-3 py-1 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 transition"
            >
              Re-book
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Page</h1>
        <Link href="/menu" className="text-blue-600 hover:underline text-sm">Back to Menu</Link>
      </div>

      <p className="text-gray-600 mb-6">
        Welcome, {customer.customer_name}
        {customer.cancellation_penalty_count > 0 && (
          <span className="text-sm text-red-500 ml-2">
            (Cancellation penalties: {customer.cancellation_penalty_count})
          </span>
        )}
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Upcoming Reservations */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Upcoming Reservations</h2>
        {upcomingReservations.length === 0 ? (
          <p className="text-gray-500 text-sm">No upcoming reservations.</p>
        ) : (
          <div className="space-y-3">
            {upcomingReservations.map((r) => renderReservation(r, "upcoming"))}
          </div>
        )}
      </section>

      {/* Past Reservations */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Past Reservations</h2>
        {pastReservations.length === 0 ? (
          <p className="text-gray-500 text-sm">No past reservations.</p>
        ) : (
          <div className="space-y-3">
            {pastReservations.map((r) => renderReservation(r, "past"))}
          </div>
        )}
      </section>

      {/* Favorites */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Favorite Staff</h2>
        <div className="flex flex-wrap gap-2">
          {staffList.map((s) => (
            <button
              key={s.staff_id}
              onClick={() => toggleFavorite(0, s.staff_id)}
              className={`px-3 py-1 rounded-full text-sm border transition ${
                isFavorite(0, s.staff_id)
                  ? "bg-red-50 border-red-300 text-red-600"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {isFavorite(0, s.staff_id) ? "♥" : "♡"} {s.staff_name}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Favorite Menus</h2>
        <div className="flex flex-wrap gap-2">
          {allMenus.map((m) => (
            <button
              key={m.menu_id}
              onClick={() => toggleFavorite(1, m.menu_id)}
              className={`px-3 py-1 rounded-full text-sm border transition ${
                isFavorite(1, m.menu_id)
                  ? "bg-red-50 border-red-300 text-red-600"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {isFavorite(1, m.menu_id) ? "♥" : "♡"} {m.menu_name}
            </button>
          ))}
        </div>
      </section>

      {/* Cancel Confirmation Dialog */}
      {cancelConfirmId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Cancel Reservation</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to cancel this reservation? Same-day cancellations may incur a penalty.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleCancel(cancelConfirmId)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
              >
                Yes, Cancel
              </button>
              <button
                onClick={() => setCancelConfirmId(null)}
                className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
              >
                No, Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <MyPageContent />
    </Suspense>
  );
}
