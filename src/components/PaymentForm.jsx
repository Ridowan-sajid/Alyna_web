import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./PaymentForm.css";
import { supabase } from "../lib/supabaseClient";
import {
  clearBookingDraft,
  clearPendingBooking,
  formatDateLabel,
  getPendingBooking,
} from "../lib/bookingFlow";
import HomeContactHeader from "./HomeContactHeader";

const ACCOUNT_NUMBER = "+8801883352526";
const DEFAULT_GATEWAY = "bkash";
const ADVANCE_AMOUNT = 500;

export default function PaymentForm() {
  const location = useLocation();
  const navigate = useNavigate();

  const [pending, setPending] = useState(() => {
    const statePending = location.state || null;
    return statePending?.bookingId ? statePending : getPendingBooking();
  });
  const [booking, setBooking] = useState(null);
  const [room, setRoom] = useState(pending?.room || null);
  const [transactionId, setTransactionId] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState(DEFAULT_GATEWAY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const nextPending = location.state?.bookingId
      ? location.state
      : getPendingBooking();
    if (nextPending?.bookingId) {
      setPending(nextPending);
      if (nextPending.room) setRoom(nextPending.room);
    }
  }, [location.state]);

  useEffect(() => {
    let mounted = true;

    const loadBooking = async () => {
      if (!pending?.bookingId) {
        setLoading(false);
        return;
      }

      try {
        const { data: bookingRow, error: bookingError } = await supabase
          .from("bookings")
          .select("*, guests(*)")
          .eq("id", pending.bookingId)
          .maybeSingle();
        if (bookingError) throw bookingError;

        const roomId = bookingRow?.room_id ?? pending?.room?.id;
        let roomRow = pending?.room || null;
        if (roomId) {
          const { data: roomData, error: roomError } = await supabase
            .from("accommodations")
            .select("*")
            .eq("id", roomId)
            .maybeSingle();
          if (roomError) throw roomError;
          roomRow = roomData || roomRow;
        }

        if (mounted) {
          setBooking(bookingRow || null);
          setRoom(roomRow || null);
        }
      } catch (err) {
        console.error("Failed to load booking details", err);
        if (mounted) {
          setError(err?.message || "Failed to load booking details.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadBooking();

    return () => {
      mounted = false;
    };
  }, [pending?.bookingId, pending?.room]);

  const roomImage = useMemo(() => {
    if (room?.image) return room.image;
    if (Array.isArray(room?.images) && room.images.length)
      return room.images[0];
    return "";
  }, [room]);

  const roomCount = Number(
    pending?.roomCount || pending?.formData?.roomCount || 1,
  );
  const roomTitle = pending?.roomTitle || `${roomCount} room`;
  const bookingRoomTotal = Number(
    booking?.total_amount ?? pending?.roomTotalAmount ?? 0,
  );
  const totalAmount = Number(
    pending?.totalAmount ?? bookingRoomTotal * roomCount,
  );
  const advanceAmount = Math.min(ADVANCE_AMOUNT, totalAmount || ADVANCE_AMOUNT);

  const handleCopyText = (type) => {
    navigator.clipboard.writeText(ACCOUNT_NUMBER);
    alert(`${type} wallet number copied to clipboard!`);
  };

  const handleReservationSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    if (!pending?.bookingId) {
      setError("No pending booking was found. Please create a booking first.");
      return;
    }

    if (!transactionId.trim()) {
      setError("Please enter your Transaction ID or Reference Number.");
      return;
    }

    if (!agreedToTerms) {
      setError("Please agree to the terms and conditions to proceed.");
      return;
    }

    setSaving(true);
    let shouldRedirect = false;
    try {
      const bookingIds = pending.bookingIds || [pending.bookingId];
      const bookingCount = bookingIds.length || 1;
      const perBookingAdvance = advanceAmount / bookingCount;
      const perBookingDue = bookingRoomTotal;
      // const notesParts = [];
      // if (booking?.notes) notesParts.push(booking.notes);
      // notesParts.push(`Payment gateway: ${selectedGateway}`);
      // notesParts.push(`Transaction ID: ${transactionId.trim()}`);
      // const nextNotes = notesParts.join(" | ");

      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          payment_method: selectedGateway,
          transaction_number: transactionId.trim(),
          // advance_amount: perBookingAdvance,
          due_amount: perBookingDue,
          // notes: nextNotes,
        })
        .in("id", bookingIds);

      if (updateError) throw updateError;

      clearPendingBooking();
      clearBookingDraft();
      setPending(null);
      setStatus("Payment details saved and booking updated successfully.");
      shouldRedirect = true;
    } catch (err) {
      console.error("Failed to update booking payment", err);
      setError(err?.message || "Failed to update payment.");
    } finally {
      setSaving(false);
    }

    if (shouldRedirect) {
      navigate("/reservation", {
        state: {
          roomTitle: room?.title || ``,
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="payment-page-wrapper">
        <div className="payment-empty-state">Loading booking summary...</div>
      </div>
    );
  }

  if (!pending?.bookingId && !booking) {
    return (
      <div className="payment-page-wrapper">
        <div className="payment-empty-state">
          <h2>No booking found</h2>
          <p>Create a room booking first, then return here for payment.</p>
          <button
            type="button"
            className="confirm-submit-btn"
            onClick={() => navigate("/book")}
          >
            Go to Booking
          </button>
        </div>
      </div>
    );
  }

  const checkInLabel = formatDateLabel(
    booking?.checkin_date || pending?.formData?.checkInDate,
  );
  const checkOutLabel = formatDateLabel(
    booking?.checkout_date || pending?.formData?.checkOutDate,
  );
  const bookingName =
    booking?.guests?.full_name || pending?.guest?.full_name || "Guest";

  return (
    <>
      <HomeContactHeader
        title={room?.title || "Choose a room from room details"}
      />
      <div className="payment-page-wrapper">
        <form onSubmit={handleReservationSubmit}>
          <div className="summary-header">
            <span>Booking Details</span>
            <span className="summary-total">Total</span>
          </div>

          <div className="room-detail-container">
            <div className="room-left-block">
              {roomImage ? (
                <img
                  className="room-image-preview"
                  src={roomImage}
                  alt={room?.title || "Room"}
                />
              ) : (
                <div className="room-image-placeholder">
                  Room <br /> Image
                </div>
              )}
              <div className="room-info">
                <h3>{room?.title || "Selected room"}</h3>
                <p className="room-highlight-text">
                  {pending?.nights || 0} night(s) x {roomTitle} x ৳
                  {room?.price || booking?.room_rate || 0}/night avg.
                </p>
                <p className="room-meta-details">
                  Date: {checkInLabel} - {checkOutLabel}
                </p>

                {/* Total price section built into the info block for mobile matching */}
                <div className="mobile-total-display">
                  <span className="total-label">TOTAL: </span>
                  <span className="total-amount">৳ {totalAmount}</span>
                </div>
              </div>
            </div>

            {/* Desktop-only total view */}
            <div className="total-price-display">BDT {totalAmount}</div>
          </div>

          <div className="payment-instruction-box">
            <p className="instruction-main-text">
              To confirm your reservation please send a minimum advance of BDT
              {advanceAmount} via bKash or Nagad to the number below, then enter
              the transaction number.
            </p>

            <div className="steps-grid">
              <div className="step-card">
                <div className="step-badge">1</div>
                <p className="step-text">
                  Open bKash or Nagad and select Make Payment
                </p>
              </div>
              <div className="step-card">
                <div className="step-badge">2</div>
                <p className="step-text">
                  Send minimum BDT {advanceAmount} to the number below
                </p>
              </div>
              <div className="step-card">
                <div className="step-badge">3</div>
                <p className="step-text">
                  Enter the transaction number in the field below
                </p>
              </div>
            </div>

            <div className="gateways-grid">
              <div
                className={`gateway-card ${selectedGateway === "bkash" ? "gateway-card--selected" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedGateway("bkash")}
                onKeyDown={() => setSelectedGateway("bkash")}
              >
                <div className="gateway-identity">
                  <div className="gateway-logo-mock logo-bkash">
                    <img
                      src="../../public/images/blash.png"
                      alt="bKash Logo"
                      style={{
                        maxWidth: "100%",
                        height: "auto",
                        display: "block",
                      }}
                    />
                  </div>
                  <div className="gateway-meta">
                    <h4>bKash</h4>
                    <p>{ACCOUNT_NUMBER}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => handleCopyText("bKash")}
                >
                  Copy
                </button>
              </div>

              <div
                className={`gateway-card ${selectedGateway === "nagad" ? "gateway-card--selected" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedGateway("nagad")}
                onKeyDown={() => setSelectedGateway("nagad")}
              >
                <div className="gateway-identity">
                  <div className="gateway-logo-mock logo-nagad">
                    <img
                      src="../../public/images/nagad.png"
                      alt="Nagad Logo"
                      style={{
                        maxWidth: "100%",
                        height: "auto",
                        display: "block",
                      }}
                    />
                  </div>
                  <div className="gateway-meta">
                    <h4>Nagad</h4>
                    <p>{ACCOUNT_NUMBER}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => handleCopyText("Nagad")}
                >
                  Copy
                </button>
              </div>
            </div>

            <label className="txid-label" htmlFor="txIdInput">
              Transaction ID or Reference Number
            </label>
            <input
              id="txIdInput"
              type="text"
              className="txid-input"
              placeholder="e.g. BAF76C3727"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
            />

            <div className="terms-row">
              <input
                type="checkbox"
                id="termsCheckbox"
                className="terms-checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
              <label htmlFor="termsCheckbox">
                I have read and agree to the{" "}
                <a href="#terms" className="terms-link">
                  terms and Conditions
                </a>{" "}
                of Hotel The Grand Alayna
              </label>
            </div>
          </div>

          {error && <div className="booking-error">{error}</div>}
          {status && <div className="payment-success">{status}</div>}

          <div className="action-container">
            <button
              type="submit"
              className="confirm-submit-btn"
              disabled={saving}
            >
              {saving ? "Updating..." : "Confirm Reservation"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
