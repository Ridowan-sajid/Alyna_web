/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  getAvailabilityState,
  getRoomInventoryConfig,
  parseCalendarRoomKey,
} from "../lib/roomInventory";

const CalendarContext = createContext(null);

const EMPTY_ROOM_DATES = {
  booked: [],
  almost: [],
  free: [],
};

const DEFAULT_ROOMS = {
  room: { ...EMPTY_ROOM_DATES },
  room2: { ...EMPTY_ROOM_DATES },
};

export function CalendarProvider({ children }) {
  const [rooms, setRooms] = useState(DEFAULT_ROOMS);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availabilityIndex, setAvailabilityIndex] = useState({});

  useEffect(() => {
    let mounted = true;

    const fetchCalendar = async () => {
      try {
        const { data, error } = await supabase
          .from("calendar_dates")
          .select("room,date,status");
        if (error) throw error;

        if (!mounted) return;

        const index = {};
        (data || []).forEach((row) => {
          const { inventoryKey, unitKey } = parseCalendarRoomKey(row.room);
          const dateStr =
            typeof row.date === "string" ? row.date : row.date && row.date.toString();
          if (!inventoryKey || !dateStr) return;
          if ((row.status || "booked") !== "booked") return;

          if (!index[inventoryKey]) index[inventoryKey] = {};
          if (!index[inventoryKey][dateStr]) index[inventoryKey][dateStr] = new Set();
          index[inventoryKey][dateStr].add(unitKey || row.room);
        });

        const roomsShape = {};
        Object.entries(index).forEach(([inventoryKey, dateMap]) => {
          const config = getRoomInventoryConfig(inventoryKey);
          roomsShape[inventoryKey] = { booked: [], almost: [], free: [] };
          Object.entries(dateMap).forEach(([dateStr, units]) => {
            const status = getAvailabilityState(units.size, config.totalRooms);
            roomsShape[inventoryKey][status].push(dateStr);
          });
        });

        setAvailabilityIndex(index);
        setRooms(roomsShape);
      } catch (err) {
        console.error("Failed to load calendar from Supabase", err);
        setRooms(DEFAULT_ROOMS);
        setAvailabilityIndex({});
      } finally {
        setLoading(false);
      }
    };

    fetchCalendar();

    // subscribe to realtime changes and refetch on change
    const channel = supabase
      .channel("public:calendar_dates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_dates" },
        () => {
          fetchCalendar();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchReservations = async () => {
      try {
        const { data, error } = await supabase
          .from("reservations")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (!mounted) return;
        setReservations(data || []);
      } catch (err) {
        console.error("Failed to load reservations from Supabase", err);
        setReservations([]);
      }
    };

    fetchReservations();

    const channel = supabase
      .channel("public:reservations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        () => {
          fetchReservations();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const getRoomCalendar = (roomId = "room") => {
    if (!roomId) return EMPTY_ROOM_DATES;
    const config = getRoomInventoryConfig(roomId);
    const key = config.inventoryKey;
    return rooms[key] || EMPTY_ROOM_DATES;
  };

  const getAvailabilityStatus = (roomId, dateStr) => {
    if (!roomId || !dateStr) return "free";
    const config = getRoomInventoryConfig(roomId);
    const key = config.inventoryKey;
    const unitMap = availabilityIndex[key] || {};
    const count = unitMap[dateStr]?.size || 0;
    return getAvailabilityState(count, config.totalRooms);
  };

  const addDate = (roomId, category, date) => {
    if (!roomId || !category || !date) return;

    setRooms((current) => {
      const roomData = current[roomId] || EMPTY_ROOM_DATES;

      return {
        ...current,
        [roomId]: {
          ...roomData,
          [category]: Array.from(
            new Set([...(roomData[category] || []), date]),
          ),
        },
      };
    });
  };

  const removeDate = (roomId, category, date) => {
    if (!roomId || !category || !date) return;

    setRooms((current) => {
      const roomData = current[roomId] || EMPTY_ROOM_DATES;

      return {
        ...current,
        [roomId]: {
          ...roomData,
          [category]: (roomData[category] || []).filter((x) => x !== date),
        },
      };
    });
  };

  const addReservation = async (reservation) => {
    if (!reservation) return null;
    const payload = {
      ...reservation,
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from("reservations")
        .insert([payload])
        .select("id")
        .single();
      if (error) throw error;

      const start = reservation.startDate || reservation.start_date;
      const end = reservation.endDate || reservation.end_date;
      const roomId = reservation.roomId || reservation.room || "room";

      if (start && end) {
        const startD = new Date(start);
        const endD = new Date(end);
        const inserts = [];
        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const dateStr = `${yyyy}-${mm}-${dd}`;
          inserts.push({ room: roomId, date: dateStr, status: "booked" });
        }

        if (inserts.length) {
          const { error: upsertErr } = await supabase
            .from("calendar_dates")
            .upsert(inserts, { onConflict: ["room", "date"] });
          if (upsertErr)
            console.error(
              "Failed to upsert calendar dates for reservation",
              upsertErr,
            );
        }
      }

      return data?.id || null;
    } catch (err) {
      console.error("Failed to add reservation", err);
      throw err;
    }
  };

  const removeReservation = async (id) => {
    if (!id) return;
    try {
      const { data: res, error: fetchErr } = await supabase
        .from("reservations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      const start = res?.startDate || res?.start_date;
      const end = res?.endDate || res?.end_date;
      const roomIdVal = res?.roomId || res?.room || "room";

      const { error } = await supabase
        .from("reservations")
        .delete()
        .eq("id", id);
      if (error) throw error;

      if (start && end) {
        const startD = new Date(start);
        const endD = new Date(end);
        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const dateStr = `${yyyy}-${mm}-${dd}`;
          const { error: delErr } = await supabase
            .from("calendar_dates")
            .delete()
            .eq("room", roomIdVal)
            .eq("date", dateStr);
          if (delErr) console.error("Failed to delete calendar date", delErr);
        }
      }
    } catch (err) {
      console.error("Failed to delete reservation", err);
      throw err;
    }
  };

  return (
    <CalendarContext.Provider
      value={{
        rooms,
        getRoomCalendar,
        getAvailabilityStatus,
        addDate,
        removeDate,
        loading,
        reservations,
        addReservation,
        removeReservation,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar(roomId) {
  const ctx = useContext(CalendarContext);

  if (!ctx) {
    throw new Error("useCalendar must be used within CalendarProvider");
  }

  if (!roomId) {
    return ctx;
  }

  const roomData = ctx.getRoomCalendar(roomId);

  return {
    ...roomData,
    addDate: (category, date) => ctx.addDate(roomId, category, date),
    removeDate: (category, date) => ctx.removeDate(roomId, category, date),
    getAvailabilityStatus: (room, date) => ctx.getAvailabilityStatus(room, date),
    loading: ctx.loading,
  };
}

export default CalendarContext;
