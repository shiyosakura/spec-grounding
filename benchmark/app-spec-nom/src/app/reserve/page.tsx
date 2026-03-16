"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface Menu {
  menu_id: number;
  menu_name: string;
  category_id: number;
  price: number;
  duration: number;
  description: string;
  category_name: string;
}

interface StaffMember {
  staff_id: number;
  staff_name: string;
  profile: string;
}

interface Slot {
  start_time: string;
  staff_id: number;
}

interface Settings {
  nomination_fee: number;
  booking_window_days: number;
  time_slot_interval: number;
}

function ReserveContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [allMenus, setAllMenus] = useState<Menu[]>([]);
  const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsMessage, setSlotsMessage] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Guest info
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Modification mode
  const [modificationSourceId, setModificationSourceId] = useState(0);

  useEffect(() => {
    // Load menus, staff, and settings
    fetch("/api/menus").then(r => r.json()).then(setAllMenus);
    fetch("/api/staff").then(r => r.json()).then(setStaffList);
    fetch("/api/settings").then(r => r.json()).then(setSettings);

    // Handle initial menu from URL
    const menuId = searchParams.get("menu_id");
    if (menuId) {
      setSelectedMenuIds([Number(menuId)]);
    }

    // Handle modification mode
    const modSource = searchParams.get("modification_source");
    if (modSource) {
      setModificationSourceId(Number(modSource));
    }

    const staffParam = searchParams.get("staff_id");
    if (staffParam) {
      setSelectedStaffId(Number(staffParam));
    }

    const dateParam = searchParams.get("date");
    if (dateParam) {
      setSelectedDate(dateParam);
    }

    const menuIdsParam = searchParams.get("menu_ids");
    if (menuIdsParam) {
      setSelectedMenuIds(menuIdsParam.split(",").map(Number));
    }
  }, [searchParams]);

  const selectedMenus = allMenus.filter(m => selectedMenuIds.includes(m.menu_id));
  const totalPrice = selectedMenus.reduce((sum, m) => sum + m.price, 0) +
    (selectedStaffId >= 1 && settings ? settings.nomination_fee : 0);
  const totalDuration = selectedMenus.reduce((sum, m) => sum + m.duration, 0);

  const fetchSlots = useCallback(async () => {
    if (selectedMenuIds.length === 0 || !selectedDate) return;

    setSlotsMessage("");
    setSlots([]);
    setSelectedSlot(null);

    try {
      const res = await fetch(
        `/api/slots?staff_id=${selectedStaffId}&date=${selectedDate}&menu_ids=${selectedMenuIds.join(",")}`
      );
      const data = await res.json();

      if (data.error) {
        setSlotsMessage(data.error);
        return;
      }
      if (data.message) {
        setSlotsMessage(data.message);
      }

      setSlots(data.slots || []);
      if ((data.slots || []).length === 0 && !data.message) {
        setSlotsMessage("No availability found for the selected criteria.");
      }
    } catch {
      setSlotsMessage("Error fetching slots.");
    }
  }, [selectedStaffId, selectedDate, selectedMenuIds]);

  useEffect(() => {
    if (selectedDate && selectedMenuIds.length > 0) {
      fetchSlots();
    }
  }, [selectedStaffId, selectedDate, selectedMenuIds, fetchSlots]);

  const handleAddMenu = (menuId: number) => {
    if (selectedMenuIds.length >= 5) return;
    if (!selectedMenuIds.includes(menuId)) {
      setSelectedMenuIds([...selectedMenuIds, menuId]);
    }
    setShowMenuModal(false);
  };

  const handleRemoveMenu = (menuId: number) => {
    if (selectedMenuIds.length <= 1) return;
    setSelectedMenuIds(selectedMenuIds.filter(id => id !== menuId));
  };

  const handleSelectSlot = (slot: Slot) => {
    setSelectedSlot(slot);
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setLoading(true);
    setError("");

    try {
      // Guest registration
      if (!customerName.trim()) {
        setError("Please enter your name.");
        setLoading(false);
        return;
      }
      if (!phoneNumber.trim() || !/^\d+$/.test(phoneNumber.trim())) {
        setError("Please enter a valid phone number.");
        setLoading(false);
        return;
      }

      const customerRes = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          phone_number: phoneNumber.trim(),
        }),
      });
      const customerData = await customerRes.json();

      if (!customerRes.ok) {
        setError(customerData.error);
        setLoading(false);
        return;
      }

      // Create reservation
      const startDatetime = `${selectedDate} ${selectedSlot.start_time}:00`;
      const reserveRes = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerData.customer_id,
          staff_id: selectedSlot.staff_id,
          is_nominated: selectedStaffId >= 1 ? 1 : 0,
          start_datetime: startDatetime,
          menu_ids: selectedMenuIds,
          modification_source_reservation_id: modificationSourceId || 0,
        }),
      });
      const reserveData = await reserveRes.json();

      if (!reserveRes.ok) {
        setError(reserveData.error);
        setLoading(false);
        return;
      }

      // Navigate to my page
      router.push(`/mypage?phone=${phoneNumber.trim()}`);
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => `¥${price.toLocaleString()}`;

  const getStaffNameForSlot = (slot: Slot) => {
    const staff = staffList.find(s => s.staff_id === slot.staff_id);
    return staff ? staff.staff_name : `Staff #${slot.staff_id}`;
  };

  // Generate date options
  const dateOptions: string[] = [];
  if (settings) {
    const today = new Date();
    for (let i = 0; i < settings.booking_window_days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dateOptions.push(d.toISOString().split("T")[0]);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create Reservation</h1>

      {modificationSourceId > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
          Modifying reservation #{modificationSourceId}. The original will be cancelled upon confirmation.
        </div>
      )}

      {/* Selected Menus */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Selected Menus</h2>
        {selectedMenus.length === 0 ? (
          <p className="text-gray-500">No menu selected</p>
        ) : (
          <div className="space-y-2">
            {selectedMenus.map((menu) => (
              <div key={menu.menu_id} className="flex justify-between items-center bg-white p-3 rounded border">
                <div>
                  <span className="font-medium">{menu.menu_name}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    {formatPrice(menu.price)} / {menu.duration}min
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveMenu(menu.menu_id)}
                  disabled={selectedMenuIds.length <= 1}
                  className="text-red-500 hover:text-red-700 disabled:opacity-30 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowMenuModal(true)}
          disabled={selectedMenuIds.length >= 5}
          className="mt-3 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30 text-sm"
        >
          + Add Menu
        </button>

        {/* Totals */}
        <div className="mt-3 p-3 bg-blue-50 rounded">
          <p className="font-medium">
            Total: {formatPrice(totalPrice)} / approx. {totalDuration} min
          </p>
          {selectedStaffId >= 1 && settings && settings.nomination_fee > 0 && (
            <p className="text-sm text-gray-600">
              (includes {formatPrice(settings.nomination_fee)} nomination fee)
            </p>
          )}
        </div>
      </section>

      {/* Staff Selection */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Select Staff</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedStaffId(0)}
            className={`px-4 py-2 rounded text-sm font-medium transition ${
              selectedStaffId === 0 ? "bg-blue-600 text-white" : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            No Preference
          </button>
          {staffList.map((staff) => (
            <button
              key={staff.staff_id}
              onClick={() => setSelectedStaffId(staff.staff_id)}
              className={`px-4 py-2 rounded text-sm font-medium transition ${
                selectedStaffId === staff.staff_id
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {staff.staff_name}
            </button>
          ))}
        </div>
      </section>

      {/* Date Selection */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Select Date</h2>
        <select
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">-- Select a date --</option>
          {dateOptions.map((d) => {
            const date = new Date(d);
            const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            return (
              <option key={d} value={d}>
                {d} ({dayNames[date.getDay()]})
              </option>
            );
          })}
        </select>
      </section>

      {/* Time Slots */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Available Time Slots</h2>
        {slotsMessage && (
          <p className="text-sm text-orange-600 mb-2">{slotsMessage}</p>
        )}
        {slots.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {slots.map((slot, i) => (
              <button
                key={i}
                onClick={() => handleSelectSlot(slot)}
                className="px-3 py-2 bg-green-50 border border-green-300 rounded text-sm hover:bg-green-100 transition"
              >
                {slot.start_time}
              </button>
            ))}
          </div>
        ) : (
          !slotsMessage && selectedDate && <p className="text-gray-500 text-sm">Select a staff and date to see available slots.</p>
        )}
      </section>

      {/* Confirmation Dialog */}
      {showConfirmation && selectedSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Confirm Reservation</h3>
            <div className="space-y-2 mb-4">
              <p><span className="font-medium">Menus:</span> {selectedMenus.map(m => m.menu_name).join(", ")}</p>
              <p>
                <span className="font-medium">Staff:</span>{" "}
                {selectedStaffId === 0
                  ? `Auto-assigned: ${getStaffNameForSlot(selectedSlot)}`
                  : getStaffNameForSlot(selectedSlot)}
              </p>
              <p><span className="font-medium">Date/Time:</span> {selectedDate} {selectedSlot.start_time}</p>
              {selectedStaffId >= 1 && settings && settings.nomination_fee > 0 && (
                <p><span className="font-medium">Nomination fee:</span> {formatPrice(settings.nomination_fee)}</p>
              )}
              <p><span className="font-medium">Total:</span> {formatPrice(totalPrice)}</p>
              <p><span className="font-medium">Duration:</span> approx. {totalDuration} min</p>
            </div>

            {/* Guest info form */}
            <div className="border-t pt-4 space-y-3">
              <h4 className="font-medium">Your Information</h4>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="09012345678"
                />
              </div>
            </div>

            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? "Processing..." : "Confirm"}
              </button>
              <button
                onClick={() => { setShowConfirmation(false); setError(""); }}
                className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Add Menu</h3>
            <div className="space-y-2">
              {allMenus
                .filter(m => !selectedMenuIds.includes(m.menu_id))
                .map((menu) => (
                  <button
                    key={menu.menu_id}
                    onClick={() => handleAddMenu(menu.menu_id)}
                    className="w-full text-left p-3 border rounded hover:bg-gray-50 transition"
                  >
                    <div className="font-medium">{menu.menu_name}</div>
                    <div className="text-sm text-gray-500">
                      {formatPrice(menu.price)} / {menu.duration} min
                    </div>
                  </button>
                ))}
            </div>
            <button
              onClick={() => setShowMenuModal(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReservePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <ReserveContent />
    </Suspense>
  );
}
