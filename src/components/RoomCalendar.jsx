import React, { useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./RoomCalender.css";
import { useCalendar } from "../context/CalendarContext";

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export default function RoomCalendar({ roomId = "room" }) {
  const [date, setDate] = useState(new Date());
  const { getAvailabilityStatus } = useCalendar(roomId);

  const getClass = ({ date }) => {
    const d = formatLocalDate(date);
    const status = getAvailabilityStatus
      ? getAvailabilityStatus(roomId, d)
      : "free";

    if (status === "booked") return "day-red";
    if (status === "almost") return "day-orange";
    return "day-green";
  };

  return (
    <div className="calendar-wrapper">
      <Calendar onChange={setDate} value={date} tileClassName={getClass} />

      <div className="legend">
        <p>
          <span className="dot red"></span> All booked
        </p>
        <p>
          <span className="dot orange"></span> Few available
        </p>
        <p>
          <span className="dot green"></span> Mostly available
        </p>
        <p style={{ color: "#6547DB" }}>
          Note: This calendar is only applicable for this particular room
          category
        </p>
      </div>
    </div>
  );
}
