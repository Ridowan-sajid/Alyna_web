const BOOKING_DRAFT_KEY = "alyna_booking_draft";
const PENDING_BOOKING_KEY = "alyna_pending_booking";

function safeLocalStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage || null;
}

export function getStoredJson(key, fallback = null) {
  const storage = safeLocalStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function setStoredJson(key, value) {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors in private mode / quota issues
  }
}

export function clearStoredJson(key) {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getRoomImage(room = {}) {
  if (!room) return "";
  if (typeof room.image === "string" && room.image.trim()) return room.image;
  const images = Array.isArray(room.images) ? room.images : [];
  return images.find((img) => typeof img === "string" && img.trim()) || "";
}

function getInventoryConfig(room = {}) {
  const roomId = room?.id;
  if (roomId === 1) {
    return {
      inventoryKey: "family-vista",
      roomNumbers: ["105", "106"],
      totalRooms: 2,
    };
  }
  if (roomId === 2 || roomId === 4) {
    return {
      inventoryKey: "shared-premium",
      roomNumbers: ["101", "102", "103", "104"],
      totalRooms: 4,
    };
  }

  return {
    inventoryKey: room?.slug || (roomId ? `room-${roomId}` : "room"),
    roomNumbers: [],
    totalRooms: 1,
  };
}

export function buildRoomSnapshot(room = {}) {
  const inventory = getInventoryConfig(room);
  const images = Array.isArray(room.images) ? room.images.filter(Boolean) : [];
  return {
    id: room.id ?? null,
    slug: room.slug ?? null,
    title: room.title ?? "Selected room",
    description: room.description ?? "",
    price: Number(room.price ?? 0) || 0,
    coupon_code: room.coupon_code ?? null,
    discount_value: Number(room.discount_value ?? 0) || 0,
    links: room.links ?? null,
    images,
    image: getRoomImage(room),
    inventoryKey: inventory.inventoryKey,
    roomNumbers: inventory.roomNumbers,
    totalRooms: inventory.totalRooms,
  };
}

export function buildBookingDraft(room = null, formData = {}) {
  return {
    room: room ? buildRoomSnapshot(room) : null,
    formData,
    savedAt: new Date().toISOString(),
  };
}

export function calculateNights(checkinDate, checkoutDate) {
  if (!checkinDate || !checkoutDate) return 0;
  const start = new Date(`${checkinDate}T00:00:00`);
  const end = new Date(`${checkoutDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = end.getTime() - start.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatDateLabel(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function expandBookingDates(checkinDate, checkoutDate) {
  const dates = [];
  if (!checkinDate || !checkoutDate) return dates;

  const start = new Date(`${checkinDate}T00:00:00`);
  const end = new Date(`${checkoutDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return dates;

  const cursor = new Date(start);
  while (cursor < end) {
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    const dd = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function getBookingDraft() {
  return getStoredJson(BOOKING_DRAFT_KEY, null);
}

export function saveBookingDraft(draft) {
  setStoredJson(BOOKING_DRAFT_KEY, draft);
}

export function clearBookingDraft() {
  clearStoredJson(BOOKING_DRAFT_KEY);
}

export function getPendingBooking() {
  return getStoredJson(PENDING_BOOKING_KEY, null);
}

export function savePendingBooking(payload) {
  setStoredJson(PENDING_BOOKING_KEY, payload);
}

export function clearPendingBooking() {
  clearStoredJson(PENDING_BOOKING_KEY);
}

export { BOOKING_DRAFT_KEY, PENDING_BOOKING_KEY };
