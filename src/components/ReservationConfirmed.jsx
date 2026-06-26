import React from "react";
import { useLocation } from "react-router-dom";
import "./ReservationConfirmed.css";
import HomeContactHeader from "./HomeContactHeader";

const ReservationConfirmed = () => {
  const location = useLocation();
  const roomTitle = location.state?.roomTitle || "";

  return (
    <>
      <HomeContactHeader title={roomTitle} />
      <div className="reservation-container">
        <div className="reservation-card">
          {/* Success Checkmark Icon */}
          <div className="checkmark-wrapper">
            <img
              src="../../public/images/confirm.png"
              alt="Success Checkmark"
              className="checkmark-icon"
              style={{ width: "11rem" }}
            />
          </div>

          {/* Content */}
          <h1 className="reservation-title">Reservation Confirmed!</h1>
          <p className="reservation-message">
            Your Reservation has been received. Our Team will contact you
            shortly.
          </p>

          {/* Back Button */}
          <button
            className="back-btn"
            onClick={() => (window.location.href = "/")}
          >
            <span className="arrow">←</span> BACK TO HOME
          </button>
        </div>
      </div>
    </>
  );
};

export default ReservationConfirmed;
