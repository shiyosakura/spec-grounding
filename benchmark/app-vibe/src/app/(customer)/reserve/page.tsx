"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface Menu {
  menu_id: number;
  menu_name: string;
  price: number;
  duration: number;
  category_name: string;
}

interface Staff {
  staff_id: number;
  staff_name: string;
}

interface Slot {
  start_time: string;
  staff_id: number;
}

function ReserveContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [allMenus, setAllMenus] = useState<Menu[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedMenuIds, setSelectedMenuIds] = useState<number[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [slotsMessage, setSlotsMessage] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showMenuPicker, setShowMenuPicker] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Modification mode
  const modSourceId = parseInt(searchParams.get("mod") || "0");
  const presetStaff = parseInt(searchParams.get("staff") || "0");
  const presetDate = searchParams.get("date") || "";

  useEffect(() => {
    fetch("/api/menus?public_only=1").then(r => r.json()).then(setAllMenus);
    fetch("/api/staff").then(r => r.json()).then((data: Staff[]) => setStaffList(data.filter((s: Staff & { is_active?: number }) => (s as Staff & { is_active: number }).is_active !== 0)));

    const menuParam = searchParams.get("menu");
    const menusParam = searchParams.get("menus");
    if (menusParam) {
      setSelectedMenuIds(menusParam.split(",").map(Number));
    } else if (menuParam) {
      setSelectedMenuIds([parseInt(menuParam)]);
    }
    if (presetStaff) setSelectedStaffId(presetStaff);
    if (presetDate) setSelectedDate(presetDate);
  }, [searchParams, presetStaff, presetDate]);

  const selectedMenus = allMenus.filter(m => selectedMenuIds.includes(m.menu_id));
  const totalPrice = selectedMenus.reduce((sum, m) => sum + m.price, 0);
  const totalDuration = selectedMenus.reduce((sum, m) => sum + m.duration, 0);

  const fetchAvailability = useCallback(async () => {
    if (selectedMenuIds.length === 0 || !selectedDate) return;
    setSlotsMessage("");
    setAvailableSlots([]);
    setSelectedTimeSlot("");
    try {
      const res = await fetch(
        `/api/availability?staff_id=${selectedStaffId}&date=${selectedDate}&menu_ids=${selectedMenuIds.join(",")}`
      );
      const data = await res.json();
      if (!res.ok) {
        setSlotsMessage(data.error || "Error fetching availability");
        return;
      }
      if (data.length === 0) {
        setSlotsMessage("No availability found for the selected criteria.");
      }
      setAvailableSlots(data);
    } catch {
      setSlotsMessage("Error fetching availability");
    }
  }, [selectedMenuIds, selectedStaffId, selectedDate]);

  useEffect(() => {
    if (selectedDate && selectedMenuIds.length > 0) {
      fetchAvailability();
    }
  }, [selectedStaffId, selectedDate, fetchAvailability]);

  function handleTimeSlotSelect(slot: Slot) {
    setSelectedTimeSlot(slot.start_time);
    setShowConfirmDialog(true);
  }

  async function handleConfirmReservation() {
    setError("");
    setLoading(true);

    try {
      let customerId: number | null = null;

      // Check if logged in (simulated: customer_id=1 from seed)
      if (!isGuest) {
        customerId = 1; // simulated logged-in user
      } else {
        // Guest registration
        if (!guestName.trim()) { setError("Please enter your name."); setLoading(false); return; }
        if (!guestPhone.trim() || !/^\d+$/.test(guestPhone)) { setError("Please enter a valid phone number."); setLoading(false); return; }

        const custRes = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_name: guestName, phone_number: guestPhone }),
        });
        const custData = await custRes.json();
        if (!custRes.ok) { setError(custData.error); setLoading(false); return; }
        customerId = custData.customer_id;
      }

      const selectedSlot = availableSlots.find(s => s.start_time === selectedTimeSlot);
      if (!selectedSlot) { setError("Invalid time slot."); setLoading(false); return; }

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          staff_id: selectedSlot.staff_id,
          is_nominated: selectedStaffId > 0 ? 1 : 0,
          start_datetime: `${selectedDate} ${selectedTimeSlot}`,
          menu_ids: selectedMenuIds,
          modification_source_reservation_id: modSourceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create reservation");
        if (data.error?.includes("conflicts")) {
          fetchAvailability();
        }
        setLoading(false);
        return;
      }

      router.push("/mypage");
    } catch {
      setError("An error occurred");
    }
    setLoading(false);
  }

  function addMenu(menuId: number) {
    if (selectedMenuIds.length >= 5) return;
    if (selectedMenuIds.includes(menuId)) return;
    setSelectedMenuIds([...selectedMenuIds, menuId]);
    setShowMenuPicker(false);
  }

  function removeMenu(menuId: number) {
    if (selectedMenuIds.length <= 1) return;
    setSelectedMenuIds(selectedMenuIds.filter(id => id !== menuId));
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {modSourceId > 0 ? "Modify Reservation" : "Make a Reservation"}
      </h1>

      {/* Selected Menus */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Selected Menus</h2>
        <div className="space-y-2">
          {selectedMenus.map(menu => (
            <div key={menu.menu_id} className="flex items-center justify-between bg-white border rounded-md p-3">
              <div>
                <span className="font-medium">{menu.menu_name}</span>
                <span className="text-gray-500 text-sm ml-2">¥{menu.price.toLocaleString()} / {menu.duration}min</span>
              </div>
              <button
                onClick={() => removeMenu(menu.menu_id)}
                disabled={selectedMenuIds.length <= 1}
                className="text-red-400 hover:text-red-600 disabled:opacity-30 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
          {selectedMenuIds.length === 0 && (
            <p className="text-gray-400 text-sm">No menu selected. Add a menu to proceed.</p>
          )}
        </div>
        <button
          onClick={() => setShowMenuPicker(true)}
          disabled={selectedMenuIds.length >= 5}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-30"
        >
          + Add menu
        </button>
        {selectedMenus.length > 0 && (
          <div className="mt-3 text-sm text-gray-700 bg-gray-50 rounded p-2">
            Total: ¥{totalPrice.toLocaleString()} / approx. {totalDuration} min
          </div>
        )}
      </section>

      {/* Staff Selection */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Staff</h2>
        <select
          value={selectedStaffId}
          onChange={e => setSelectedStaffId(parseInt(e.target.value))}
          className="w-full border rounded-md p-2 bg-white"
        >
          <option value={0}>No preference</option>
          {staffList.map(s => (
            <option key={s.staff_id} value={s.staff_id}>{s.staff_name}</option>
          ))}
        </select>
      </section>

      {/* Date Selection */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Date</h2>
        <input
          type="date"
          value={selectedDate}
          min={today}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-full border rounded-md p-2 bg-white"
        />
      </section>

      {/* Time Slots */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Available Time Slots</h2>
        {slotsMessage && <p className="text-gray-500 text-sm">{slotsMessage}</p>}
        <div className="grid grid-cols-4 gap-2">
          {availableSlots.map(slot => (
            <button
              key={slot.start_time}
              onClick={() => handleTimeSlotSelect(slot)}
              className={`py-2 px-3 rounded-md border text-sm transition ${
                selectedTimeSlot === slot.start_time
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white hover:bg-gray-50 border-gray-300"
              }`}
            >
              {slot.start_time}
            </button>
          ))}
        </div>
      </section>

      {/* Guest toggle */}
      <section className="mb-6">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={isGuest} onChange={e => setIsGuest(e.target.checked)} />
          Book as guest (not logged in)
        </label>
      </section>

      {/* Menu Picker Modal */}
      {showMenuPicker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowMenuPicker(false)}>
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-4">Add Menu</h3>
            {allMenus.filter(m => !selectedMenuIds.includes(m.menu_id)).map(menu => (
              <button
                key={menu.menu_id}
                onClick={() => addMenu(menu.menu_id)}
                className="w-full text-left p-3 border-b hover:bg-gray-50"
              >
                <div className="font-medium">{menu.menu_name}</div>
                <div className="text-sm text-gray-500">¥{menu.price.toLocaleString()} / {menu.duration}min</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-4">Confirm Reservation</h3>
            <div className="space-y-2 text-sm mb-4">
              <p><span className="text-gray-500">Menus:</span> {selectedMenus.map(m => m.menu_name).join(", ")}</p>
              <p><span className="text-gray-500">Staff:</span> {
                selectedStaffId > 0
                  ? staffList.find(s => s.staff_id === selectedStaffId)?.staff_name
                  : `Auto-assigned: ${staffList.find(s => s.staff_id === availableSlots.find(sl => sl.start_time === selectedTimeSlot)?.staff_id)?.staff_name || "TBD"}`
              }</p>
              <p><span className="text-gray-500">Date/Time:</span> {selectedDate} {selectedTimeSlot}</p>
              <p><span className="text-gray-500">Total:</span> ¥{totalPrice.toLocaleString()} / approx. {totalDuration} min</p>
            </div>

            {isGuest && (
              <div className="space-y-3 border-t pt-4 mb-4">
                <h4 className="font-medium text-sm">Guest Information</h4>
                <input
                  type="text"
                  placeholder="Your name"
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  className="w-full border rounded-md p-2 text-sm"
                />
                <input
                  type="tel"
                  placeholder="Phone number (digits only)"
                  value={guestPhone}
                  onChange={e => setGuestPhone(e.target.value)}
                  className="w-full border rounded-md p-2 text-sm"
                />
              </div>
            )}

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirmDialog(false); setError(""); }}
                className="flex-1 py-2 border rounded-md text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReservation}
                disabled={loading}
                className="flex-1 py-2 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50"
              >
                {loading ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReservePage() {
  return (
    <Suspense fallback={<div className="text-center py-10 text-gray-400">Loading...</div>}>
      <ReserveContent />
    </Suspense>
  );
}
