"use client";

import { useState, useEffect, useCallback } from "react";

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
  customer_name: string;
  phone_number: string;
  is_nominated: number;
  nomination_fee: number;
  start_datetime: string;
  total_duration: number;
  status: number;
  menus: ReservationMenu[];
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

const STATUS_COLORS: Record<number, string> = {
  0: "bg-green-100 text-green-800",
  1: "bg-gray-100 text-gray-600",
  2: "bg-blue-100 text-blue-800",
  3: "bg-purple-100 text-purple-800",
  4: "bg-red-100 text-red-800",
};

export default function AdminCalendarPage() {
  const [displayDate, setDisplayDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [displayMode, setDisplayMode] = useState<0 | 1>(0); // 0=daily, 1=weekly
  const [filterStaffId, setFilterStaffId] = useState(0);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [error, setError] = useState("");

  const fetchReservations = useCallback(async () => {
    let dateFrom = displayDate;
    let dateTo = displayDate;

    if (displayMode === 1) {
      // Weekly: find Monday of the week
      const d = new Date(displayDate);
      const dayOfWeek = d.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(d);
      monday.setDate(monday.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      dateFrom = monday.toISOString().split("T")[0];
      dateTo = sunday.toISOString().split("T")[0];
    }

    let url = `/api/reservations?date_from=${dateFrom}&date_to=${dateTo}`;
    if (filterStaffId > 0) {
      url += `&staff_id=${filterStaffId}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    setReservations(data);
  }, [displayDate, displayMode, filterStaffId]);

  useEffect(() => {
    fetch("/api/staff?include_inactive=1").then(r => r.json()).then(setStaffList);
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const changeDate = (delta: number) => {
    const d = new Date(displayDate);
    d.setDate(d.getDate() + delta);
    setDisplayDate(d.toISOString().split("T")[0]);
  };

  const handleStatusUpdate = async (reservationId: number, newStatus: number) => {
    setError("");
    const res = await fetch(`/api/reservations/${reservationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setSelectedReservation(null);
    fetchReservations();
  };

  const formatTime = (datetime: string) => {
    const timePart = datetime.includes("T") ? datetime.split("T")[1] : datetime.split(" ")[1];
    return timePart ? timePart.substring(0, 5) : "";
  };

  const addMinutesToTime = (datetime: string, minutes: number) => {
    const timePart = formatTime(datetime);
    const [h, m] = timePart.split(":").map(Number);
    const totalMinutes = h * 60 + m + minutes;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${newH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")}`;
  };

  const formatPrice = (price: number) => `¥${price.toLocaleString()}`;

  // Group reservations by staff
  const groupedByStaff = new Map<number, Reservation[]>();
  for (const r of reservations) {
    if (!groupedByStaff.has(r.staff_id)) {
      groupedByStaff.set(r.staff_id, []);
    }
    groupedByStaff.get(r.staff_id)!.push(r);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Reservation Calendar</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
            &lt; Prev
          </button>
          <input
            type="date"
            value={displayDate}
            onChange={(e) => setDisplayDate(e.target.value)}
            className="p-1 border rounded"
          />
          <button onClick={() => changeDate(1)} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
            Next &gt;
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setDisplayMode(0)}
            className={`px-3 py-1 rounded text-sm ${displayMode === 0 ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            Daily
          </button>
          <button
            onClick={() => setDisplayMode(1)}
            className={`px-3 py-1 rounded text-sm ${displayMode === 1 ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            Weekly
          </button>
        </div>

        <select
          value={filterStaffId}
          onChange={(e) => setFilterStaffId(Number(e.target.value))}
          className="p-1 border rounded text-sm"
        >
          <option value={0}>All Staff</option>
          {staffList.map((s) => (
            <option key={s.staff_id} value={s.staff_id}>
              {s.staff_name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Reservation List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {groupedByStaff.size === 0 ? (
            <p className="text-gray-500">No reservations for this period.</p>
          ) : (
            Array.from(groupedByStaff.entries()).map(([staffId, staffReservations]) => {
              const staffName = staffList.find(s => s.staff_id === staffId)?.staff_name || `Staff #${staffId}`;
              return (
                <div key={staffId} className="mb-6">
                  <h3 className="text-md font-semibold mb-2 text-gray-700">{staffName}</h3>
                  <div className="space-y-2">
                    {staffReservations.map((r) => (
                      <div
                        key={r.reservation_id}
                        onClick={() => setSelectedReservation(r)}
                        className={`p-3 rounded border cursor-pointer transition ${
                          selectedReservation?.reservation_id === r.reservation_id
                            ? "border-blue-500 bg-blue-50"
                            : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-medium">
                              {formatTime(r.start_datetime)}–{addMinutesToTime(r.start_datetime, r.total_duration)}
                            </span>
                            <span className="ml-2 text-sm text-gray-600">{r.customer_name}</span>
                            <span className="ml-2 text-xs text-gray-400">
                              {r.menus.map(m => m.menu_name).join(", ")}
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[r.status]}`}>
                            {STATUS_LABELS[r.status]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selectedReservation ? (
            <div className="bg-white rounded-lg border p-4 sticky top-6">
              <h3 className="font-bold mb-3">Reservation Detail</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Customer:</span> {selectedReservation.customer_name}</p>
                <p><span className="font-medium">Phone:</span> {selectedReservation.phone_number}</p>
                <p>
                  <span className="font-medium">Date/Time:</span>{" "}
                  {selectedReservation.start_datetime.substring(0, 16).replace("T", " ").replace(/-/g, "/")}
                </p>
                <p><span className="font-medium">Staff:</span> {selectedReservation.staff_name}</p>
                <p>
                  <span className="font-medium">Nomination:</span>{" "}
                  {selectedReservation.is_nominated === 1 ? "Nominated" : "No preference"}
                </p>
                {selectedReservation.nomination_fee > 0 && (
                  <p>
                    <span className="font-medium">Nomination fee:</span>{" "}
                    {formatPrice(selectedReservation.nomination_fee)}
                  </p>
                )}
                <div>
                  <span className="font-medium">Menus:</span>
                  <ul className="ml-4 mt-1">
                    {selectedReservation.menus.map((m) => (
                      <li key={m.menu_id}>
                        {m.menu_name} — {formatPrice(m.price_at_booking)} / {m.duration_at_booking} min
                      </li>
                    ))}
                  </ul>
                </div>
                <p>
                  <span className="font-medium">Total:</span>{" "}
                  {formatPrice(
                    selectedReservation.menus.reduce((sum, m) => sum + m.price_at_booking, 0) +
                    selectedReservation.nomination_fee
                  )}
                </p>
                <p>
                  <span className="font-medium">Status:</span>{" "}
                  <span className={`px-2 py-0.5 rounded ${STATUS_COLORS[selectedReservation.status]}`}>
                    {STATUS_LABELS[selectedReservation.status]}
                  </span>
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 mt-4">
                {selectedReservation.status === 0 && (
                  <>
                    <button
                      onClick={() => handleStatusUpdate(selectedReservation.reservation_id, 2)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
                    >
                      Check-in
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedReservation.reservation_id, 4)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm"
                    >
                      No-Show
                    </button>
                  </>
                )}
                {selectedReservation.status === 2 && (
                  <button
                    onClick={() => handleStatusUpdate(selectedReservation.reservation_id, 3)}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition text-sm"
                  >
                    Complete Service
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border p-4 text-center text-gray-500">
              Select a reservation to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
