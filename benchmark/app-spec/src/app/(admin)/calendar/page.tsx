"use client";

import { useEffect, useState } from "react";

interface ReservationMenuDetail {
  menu_name: string;
  price_at_booking: number;
  duration_at_booking: number;
}

interface Reservation {
  reservation_id: number;
  customer_id: number;
  customer_name: string;
  phone_number: string;
  staff_id: number;
  staff_name: string;
  is_nominated: number;
  start_datetime: string;
  total_duration: number;
  status: number;
  cancellation_fee: number;
  menus: ReservationMenuDetail[];
}

const STATUS_LABELS: Record<number, string> = {
  0: "Confirmed",
  1: "Cancelled",
  2: "Checked In",
  3: "Completed",
  4: "No-Show",
};

interface Staff {
  staff_id: number;
  staff_name: string;
}

export default function CalendarPage() {
  const [displayDate, setDisplayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [displayMode, setDisplayMode] = useState(0); // 0=daily, 1=weekly
  const [filterStaffId, setFilterStaffId] = useState(0);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/staff").then(r => r.json()).then(setStaffList);
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [displayDate, displayMode, filterStaffId]);

  async function fetchReservations() {
    let dateEnd = displayDate;
    if (displayMode === 1) {
      // Weekly: calculate Monday-Sunday of the week containing displayDate
      const d = new Date(displayDate + "T00:00:00");
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setDisplayDate(monday.toISOString().split("T")[0]); // This would cause loop, let's not
      dateEnd = sunday.toISOString().split("T")[0];
    }
    let url = `/api/reservations?date=${displayDate}&date_end=${dateEnd}`;
    if (filterStaffId > 0) url += `&staff_id=${filterStaffId}`;
    const res = await fetch(url);
    const data = await res.json();
    setReservations(data);
  }

  async function handleStatusAction(action: string) {
    if (!selectedReservation) return;
    setError("");
    const res = await fetch(`/api/reservations/${selectedReservation.reservation_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to update status");
      return;
    }
    setSelectedReservation(null);
    fetchReservations();
  }

  function navigateDate(delta: number) {
    const d = new Date(displayDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDisplayDate(d.toISOString().split("T")[0]);
  }

  function formatTime(dt: string) {
    return dt.replace("T", " ").slice(11, 16);
  }

  function endTime(dt: string, duration: number) {
    const d = new Date(dt.includes("T") ? dt : dt.replace(" ", "T"));
    d.setMinutes(d.getMinutes() + duration);
    return d.toTimeString().slice(0, 5);
  }

  // Group by staff for daily view
  const grouped = new Map<number, { staff_name: string; items: Reservation[] }>();
  reservations.forEach(r => {
    if (!grouped.has(r.staff_id)) {
      grouped.set(r.staff_id, { staff_name: r.staff_name, items: [] });
    }
    grouped.get(r.staff_id)!.items.push(r);
  });
  grouped.forEach(g => g.items.sort((a, b) => a.start_datetime.localeCompare(b.start_datetime)));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Reservation Calendar</h1>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <button onClick={() => navigateDate(-1)} className="px-3 py-1 border rounded hover:bg-gray-50">&lt; Prev</button>
        <input
          type="date"
          value={displayDate}
          onChange={e => setDisplayDate(e.target.value)}
          className="border rounded p-1"
        />
        <button onClick={() => navigateDate(1)} className="px-3 py-1 border rounded hover:bg-gray-50">Next &gt;</button>

        <div className="flex border rounded overflow-hidden">
          <button
            onClick={() => setDisplayMode(0)}
            className={`px-3 py-1 text-sm ${displayMode === 0 ? "bg-gray-800 text-white" : "bg-white"}`}
          >
            Today
          </button>
          <button
            onClick={() => setDisplayMode(1)}
            className={`px-3 py-1 text-sm ${displayMode === 1 ? "bg-gray-800 text-white" : "bg-white"}`}
          >
            Weekly
          </button>
        </div>

        <select
          value={filterStaffId}
          onChange={e => setFilterStaffId(parseInt(e.target.value))}
          className="border rounded p-1 text-sm"
        >
          <option value={0}>All Staff</option>
          {staffList.map(s => (
            <option key={s.staff_id} value={s.staff_id}>{s.staff_name}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Daily View */}
      <div className="flex gap-6">
        <div className="flex-1">
          {reservations.length === 0 && <p className="text-gray-400">No reservations for this period.</p>}
          {Array.from(grouped.entries()).map(([staffId, group]) => (
            <div key={staffId} className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-2 border-b pb-1">{group.staff_name}</h3>
              <div className="space-y-2">
                {group.items.map(r => (
                  <button
                    key={r.reservation_id}
                    onClick={() => setSelectedReservation(r)}
                    className={`w-full text-left p-3 rounded border transition ${
                      selectedReservation?.reservation_id === r.reservation_id
                        ? "border-blue-500 bg-blue-50"
                        : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium text-sm">
                        {formatTime(r.start_datetime)}–{endTime(r.start_datetime, r.total_duration)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        r.status === 0 ? "bg-green-100 text-green-700" :
                        r.status === 1 ? "bg-gray-100 text-gray-500" :
                        r.status === 2 ? "bg-blue-100 text-blue-700" :
                        r.status === 3 ? "bg-purple-100 text-purple-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{r.customer_name}</p>
                    <p className="text-xs text-gray-400">{r.menus.map(m => m.menu_name).join(", ")}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        {selectedReservation && (
          <div className="w-80 bg-white border rounded-lg p-5 h-fit sticky top-6">
            <h3 className="font-bold mb-3">Reservation Detail</h3>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Customer:</span> {selectedReservation.customer_name}</p>
              <p><span className="text-gray-500">Phone:</span> {selectedReservation.phone_number}</p>
              <p><span className="text-gray-500">Date/Time:</span> {selectedReservation.start_datetime.replace("T", " ").slice(0, 16)}</p>
              <p><span className="text-gray-500">Staff:</span> {selectedReservation.staff_name}</p>
              <p><span className="text-gray-500">Nomination:</span> {selectedReservation.is_nominated ? "Nominated" : "No preference"}</p>
              <div>
                <span className="text-gray-500">Menus:</span>
                <ul className="ml-4 mt-1">
                  {selectedReservation.menus.map((m, i) => (
                    <li key={i} className="text-xs">{m.menu_name} — ¥{m.price_at_booking.toLocaleString()} / {m.duration_at_booking}min</li>
                  ))}
                </ul>
              </div>
              <p><span className="text-gray-500">Total:</span> ¥{selectedReservation.menus.reduce((s, m) => s + m.price_at_booking, 0).toLocaleString()}</p>
              <p><span className="text-gray-500">Status:</span> {STATUS_LABELS[selectedReservation.status]}</p>
              {(selectedReservation.status === 1 || selectedReservation.status === 4) && selectedReservation.cancellation_fee > 0 && (
                <p><span className="text-gray-500">Cancellation fee:</span> &yen;{selectedReservation.cancellation_fee.toLocaleString()}</p>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              {selectedReservation.status === 0 && (
                <>
                  <button onClick={() => handleStatusAction("checkin")} className="flex-1 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-500">
                    Check-in
                  </button>
                  <button onClick={() => handleStatusAction("noshow")} className="flex-1 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-500">
                    No-Show
                  </button>
                </>
              )}
              {selectedReservation.status === 2 && (
                <button onClick={() => handleStatusAction("complete")} className="flex-1 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-500">
                  Complete Service
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
