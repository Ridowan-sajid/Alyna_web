import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./BookingForm.css";
import { supabase } from "../lib/supabaseClient";
import {
  buildBookingDraft,
  calculateNights,
  getBookingDraft,
  saveBookingDraft,
  savePendingBooking,
  expandBookingDates,
} from "../lib/bookingFlow";
import {
  getRoomInventoryConfig,
  getRoomPhysicalUnitKey,
  parseCalendarRoomKey,
} from "../lib/roomInventory";
import HomeContactHeader from "./HomeContactHeader";

const EMPTY_FORM = {
  checkInDate: "",
  checkOutDate: "",
  roomCount: "1",
  adults: "1",
  children: "0",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  nationality: "",
  refName: "",
  refPhone: "",
  idType: "",
  idNumber: "",
  specialRequest: "",
};

async function syncBookingCalendar({
  bookingId,
  room,
  checkInDate,
  checkOutDate,
}) {
  const inventory = getRoomInventoryConfig(room);
  const roomKey = inventory.inventoryKey;
  const bookedDates = expandBookingDates(checkInDate, checkOutDate);
  const unitNumber =
    room?.allocatedUnitNumber ||
    inventory.roomNumbers[0] ||
    String(room?.id || "room");

  if (bookedDates.length) {
    const rows = bookedDates.map((date) => ({
      room: getRoomPhysicalUnitKey(roomKey, unitNumber) || roomKey,
      date,
      status: "booked",
    }));

    const { error } = await supabase
      .from("calendar_dates")
      .upsert(rows, { onConflict: "room,date" });
    if (error) throw error;
  }

  try {
    await supabase.from("calendar").delete().eq("booking_id", bookingId);

    const { error } = await supabase.from("calendar").insert([
      {
        booking_id: bookingId,
        room_id: room?.id ?? null,
        check_in: checkInDate,
        check_out: checkOutDate,
      },
    ]);
    if (error) {
      console.warn("Calendar table sync skipped:", error.message || error);
    }
  } catch (err) {
    console.warn("Calendar table sync skipped:", err.message || err);
  }
}

async function findAvailableUnit(room, checkInDate, checkOutDate) {
  const inventory = getRoomInventoryConfig(room);
  const bookedDates = new Set(expandBookingDates(checkInDate, checkOutDate));
  const unitNumbers = inventory.roomNumbers.length
    ? inventory.roomNumbers
    : [String(room?.id || "room")];

  const { data, error } = await supabase
    .from("calendar_dates")
    .select("room,date,status");
  if (error) throw error;

  const bookedCountByDate = new Map();
  (data || []).forEach((row) => {
    if ((row.status || "booked") !== "booked") return;
    const { inventoryKey } = parseCalendarRoomKey(row.room);
    const dateStr =
      typeof row.date === "string" ? row.date : row.date && row.date.toString();
    if (inventoryKey === inventory.inventoryKey && bookedDates.has(dateStr)) {
      bookedCountByDate.set(dateStr, (bookedCountByDate.get(dateStr) || 0) + 1);
    }
  });

  const occupiedUnits = new Set();
  for (const count of bookedCountByDate.values()) {
    unitNumbers
      .slice(0, Math.min(count, unitNumbers.length))
      .forEach((unit) => {
        occupiedUnits.add(unit);
      });
  }

  return unitNumbers.find((unit) => !occupiedUnits.has(unit)) || null;
}

async function findAvailableUnits(room, checkInDate, checkOutDate, count) {
  const inventory = getRoomInventoryConfig(room);
  const bookedDates = new Set(expandBookingDates(checkInDate, checkOutDate));
  const unitNumbers = inventory.roomNumbers.length
    ? inventory.roomNumbers
    : [String(room?.id || "room")];

  const { data, error } = await supabase
    .from("calendar_dates")
    .select("room,date,status");
  if (error) throw error;

  const occupiedUnits = new Set();
  (data || []).forEach((row) => {
    if ((row.status || "booked") !== "booked") return;
    const { inventoryKey, unitKey } = parseCalendarRoomKey(row.room);
    const dateStr =
      typeof row.date === "string" ? row.date : row.date && row.date.toString();
    if (inventoryKey !== inventory.inventoryKey || !bookedDates.has(dateStr)) {
      return;
    }
    if (unitKey) occupiedUnits.add(unitKey);
  });

  return unitNumbers.filter((unit) => !occupiedUnits.has(unit)).slice(0, count);
}

export default function BookingForm() {
  const location = useLocation();
  const navigate = useNavigate();

  const [room, setRoom] = useState(() => {
    const draft = getBookingDraft();
    return location.state?.room || draft?.room || null;
  });
  const [formData, setFormData] = useState(() => {
    const draft = getBookingDraft();
    return { ...EMPTY_FORM, ...(draft?.formData || {}) };
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (location.state?.room) {
      setRoom(location.state.room);
    } else {
      const draft = getBookingDraft();
      if (draft?.room) setRoom(draft.room);
    }

    if (location.state?.formData) {
      setFormData((prev) => ({ ...prev, ...location.state.formData }));
    } else {
      const draft = getBookingDraft();
      if (draft?.formData) {
        setFormData((prev) => ({ ...prev, ...draft.formData }));
      }
    }
  }, [location.state]);

  useEffect(() => {
    saveBookingDraft(buildBookingDraft(room, formData));
  }, [room, formData]);

  const nights = useMemo(
    () => calculateNights(formData.checkInDate, formData.checkOutDate),
    [formData.checkInDate, formData.checkOutDate],
  );

  const roomCount = Number(formData.roomCount) || 1;
  const roomRate = Number(room?.price || 0);
  const roomTotalAmount = nights * roomRate;
  const totalAmount = roomTotalAmount * roomCount;
  const fullName = `${formData.firstName} ${formData.lastName}`.trim();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!room?.id) {
      setError("Please select a room first.");
      return;
    }

    if (!formData.checkInDate || !formData.checkOutDate) {
      setError("Please select both check-in and check-out dates.");
      return;
    }

    if (!nights) {
      setError("Check-out must be later than check-in.");
      return;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("Please enter the guest name.");
      return;
    }

    if (!formData.phone.trim()) {
      setError("Please enter a phone number.");
      return;
    }

    setSubmitting(true);

    try {
      const inventory = getRoomInventoryConfig(room);
      const allocatedUnitNumbers =
        roomCount > 1
          ? await findAvailableUnits(
              room,
              formData.checkInDate,
              formData.checkOutDate,
              roomCount,
            )
          : [
              await findAvailableUnit(
                room,
                formData.checkInDate,
                formData.checkOutDate,
              ),
            ];
      const validAllocatedUnitNumbers = allocatedUnitNumbers.filter(Boolean);

      if (validAllocatedUnitNumbers.length < roomCount) {
        setError("No available rooms left for the selected dates.");
        return;
      }

      const { data: guestRow, error: guestError } = await supabase
        .from("guests")
        .insert([
          {
            full_name: fullName,
            phone: formData.phone.trim(),
            nationality: formData.nationality.trim() || null,
            email: formData.email.trim() || null,
            ref_name: formData.refName.trim() || null,
            ref_phone: formData.refPhone.trim() || null,
            id_type: formData.idType.trim() || null,
            id_number: formData.idNumber.trim() || null,
          },
        ])
        .select("id")
        .single();

      if (guestError) throw guestError;

      const bookingPayloads = validAllocatedUnitNumbers.map(() => ({
        guest_id: guestRow.id,
        room_id: room.id,
        checkin_date: formData.checkInDate,
        checkout_date: formData.checkOutDate,
        adults: Number(formData.adults) || 1,
        children: Number(formData.children) || 0,
        room_rate: roomRate,
        ac_choice: room.title || null,
        base_amount: roomTotalAmount,
        discount_type: null,
        discount_amount: 0,
        discount_reason: null,
        payment_method: "pending",
        transaction_number: null,
        total_amount: roomTotalAmount,
        advance_amount: 0,
        due_amount: roomTotalAmount,
        notes: formData.specialRequest.trim() || null,
        is_reservation: true,
        created_by: null,
      }));

      const { data: bookingRows, error: bookingError } = await supabase
        .from("bookings")
        .insert(bookingPayloads)
        .select("id");

      if (bookingError) throw bookingError;

      const bookingIds = (bookingRows || []).map((row) => row.id);

      for (const [index, unitNumber] of validAllocatedUnitNumbers.entries()) {
        const bookingId = bookingIds[index];
        await syncBookingCalendar({
          bookingId,
          room: {
            ...room,
            inventoryKey: inventory.inventoryKey,
            allocatedUnitNumber: unitNumber,
          },
          checkInDate: formData.checkInDate,
          checkOutDate: formData.checkOutDate,
        });
      }

      const roomTitle = `${roomCount} room`;

      const pendingBooking = {
        bookingId: bookingIds[0] || null,
        bookingIds,
        guestId: guestRow.id,
        room,
        roomCount,
        roomTitle,
        inventoryKey: inventory.inventoryKey,
        allocatedUnitNumber: validAllocatedUnitNumbers[0] || null,
        guest: {
          full_name: fullName,
          phone: formData.phone.trim(),
          email: formData.email.trim() || null,
        },
        formData,
        nights,
        roomTotalAmount,
        totalAmount,
      };

      savePendingBooking(pendingBooking);
      saveBookingDraft(buildBookingDraft(room, formData));

      navigate("/payment", { state: pendingBooking });
    } catch (err) {
      console.error("Failed to save booking", err);
      setError(err?.message || "Failed to create booking.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <HomeContactHeader
        title={room?.title || "Choose a room from room details"}
      />
      <main className="booking-page-wrapper">
        <form onSubmit={handleSubmit}>
          {/* <section className="sect-container">
            <h2 className="section-title">Selected Room</h2>
            <div className="booking-room-summary">
              <div className="booking-room-image-wrap">
                {roomImage ? (
                  <img src={roomImage} alt={room?.title || "Room"} />
                ) : (
                  <div className="booking-room-placeholder">Room</div>
                )}
              </div>
              <div className="booking-room-copy">
                <h3>{room?.title || "Choose a room from room details"}</h3>
                <p>{room?.description || "Your selected room will appear here."}</p>
                <div className="booking-room-meta">
                  <span>
                    From BDT {roomRate}
                  </span>
                  <span>{room?.slug || ""}</span>
                </div>
              </div>
            </div>
          </section> */}

          <section id="booking-form-section" className="sect-container">
            <h2 className="section-title">Select Your Date</h2>
            <div className="purple-card-panel grid-4-col">
              <div className="input-group">
                <label>Check In</label>
                <input
                  type="date"
                  name="checkInDate"
                  value={formData.checkInDate}
                  onChange={handleChange}
                  className="input-transparent"
                />
              </div>

              <div className="input-group">
                <label>Check Out</label>
                <input
                  type="date"
                  name="checkOutDate"
                  value={formData.checkOutDate}
                  onChange={handleChange}
                  className="input-transparent"
                />
              </div>

              <div className="input-group">
                <label>Room</label>
                <select
                  name="roomCount"
                  value={formData.roomCount}
                  onChange={handleChange}
                  className="input-transparent"
                >
                  <option value="1">1 room</option>
                  <option value="2">2 room</option>
                </select>
              </div>

              <div className="input-group">
                <label>Guests</label>
                <select
                  name="adults"
                  value={formData.adults}
                  onChange={handleChange}
                  className="input-transparent"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </div>

              {/* <div className="input-group">
                <label>Children</label>
                <select
                  name="children"
                  value={formData.children}
                  onChange={handleChange}
                  className="input-transparent"
                >
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
              </div> */}
            </div>
          </section>

          <section className="sect-container">
            <h2 className="section-title">Guest Details</h2>
            <div className="purple-card-guest">
              <div className="grid-2-col">
                <div className="input-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="input-white"
                    placeholder="Shohanul"
                  />
                </div>
                <div className="input-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="input-white"
                    placeholder="Hasan"
                  />
                </div>
              </div>

              <div className="grid-2-col">
                <div className="input-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input-white"
                    placeholder="shohanulhasan@gmail.com"
                  />
                </div>
                <div className="input-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input-white"
                    placeholder="880"
                  />
                </div>
              </div>

              {/* <div className="grid-2-col">
                <div className="input-group" style={{ display: "none" }}>
                  <label>Nationality</label>
                  <input
                    type="text"
                    name="nationality"
                    value={formData.nationality}
                    onChange={handleChange}
                    className="input-white"
                    placeholder="Bangladeshi"
                  />
                </div>
                <div className="input-group" style={{ display: "none" }}>
                  <label>Reference Phone</label>
                  <input
                    type="tel"
                    name="refPhone"
                    value={formData.refPhone}
                    onChange={handleChange}
                    className="input-white"
                    placeholder="880"
                  />
                </div>
              </div>

              <div className="grid-2-col">
                <div className="input-group" style={{ display: "none" }}>
                  <label>Reference Name</label>
                  <input
                    type="text"
                    name="refName"
                    value={formData.refName}
                    onChange={handleChange}
                    className="input-white"
                    placeholder="Optional"
                  />
                </div>
                <div className="input-group" style={{ display: "none" }}>
                  <label>ID Type</label>
                  <input
                    type="text"
                    name="idType"
                    value={formData.idType}
                    onChange={handleChange}
                    className="input-white"
                    placeholder="NID / Passport"
                  />
                </div>
              </div> */}

              {/* <div className="input-group" style={{ display: "none" }}>
                <label>ID Number</label>
                <input
                  type="text"
                  name="idNumber"
                  value={formData.idNumber}
                  onChange={handleChange}
                  className="input-white"
                  placeholder="Optional"
                />
              </div> */}

              <div className="input-group">
                <label>Special Request</label>
                <textarea
                  name="specialRequest"
                  value={formData.specialRequest}
                  onChange={handleChange}
                  className="textarea-white"
                />
              </div>
            </div>
          </section>

          <section className="sect-container">
            {/* <div className="booking-total-bar">
              <div>
                <strong>{fullName || "Guest Name"}</strong>
                <p>
                  {formData.checkInDate && formData.checkOutDate
                    ? `${formatDateLabel(formData.checkInDate)} - ${formatDateLabel(formData.checkOutDate)}`
                    : "Choose your stay dates"}
                </p>
              </div>
              <div className="booking-total-value">BDT {totalAmount || 0}</div>
            </div> */}
            {error && <div className="booking-error">{error}</div>}
          </section>

          <div className="submit-container">
            <button type="submit" className="proceed-btn" disabled={submitting}>
              <span>{submitting ? "Saving..." : "Proceed to Payment"}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M5 3l3.057-3 11.943 12-11.943 12-3.057-3 9-9z" />
              </svg>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
