const INVENTORY_CONFIGS = [
  {
    inventoryKey: "family-vista",
    roomIds: [1],
    roomNumbers: ["105", "106"],
    totalRooms: 2,
    label: "Family Vista",
  },
  {
    inventoryKey: "shared-premium",
    roomIds: [2, 4],
    roomNumbers: ["101", "102", "103", "104"],
    totalRooms: 4,
    label: "Grand Prestige / Explorer Dune",
  },
];

const ROOM_ID_TO_CONFIG = new Map(
  INVENTORY_CONFIGS.flatMap((config) =>
    config.roomIds.map((roomId) => [String(roomId), config]),
  ),
);

export function getRoomInventoryConfig(roomOrId) {
  if (roomOrId === null || roomOrId === undefined) {
    return {
      inventoryKey: "room",
      roomIds: [],
      roomNumbers: [],
      totalRooms: 1,
      label: "Room",
    };
  }

  const roomId =
    typeof roomOrId === "object" ? roomOrId.id ?? roomOrId.room_id : roomOrId;
  const key = String(roomId);
  const directMatch = INVENTORY_CONFIGS.find(
    (config) => config.inventoryKey === key,
  );
  if (directMatch) return directMatch;
  const matched = ROOM_ID_TO_CONFIG.get(key);
  if (matched) return matched;

  const slug = typeof roomOrId === "object" ? roomOrId.slug : null;
  if (slug && String(slug).toLowerCase().includes("family")) {
    return INVENTORY_CONFIGS[0];
  }
  if (
    slug &&
    (String(slug).toLowerCase().includes("grand") ||
      String(slug).toLowerCase().includes("explorer"))
  ) {
    return INVENTORY_CONFIGS[1];
  }

  return {
    inventoryKey: `room-${key}`,
    roomIds: [roomId].filter((v) => v !== undefined && v !== null),
    roomNumbers: [],
    totalRooms: 1,
    label: typeof roomOrId === "object" ? roomOrId.title || "Room" : "Room",
  };
}

export function getInventoryKeyFromRoom(roomOrId) {
  return getRoomInventoryConfig(roomOrId).inventoryKey;
}

export function getRoomPhysicalUnitKey(inventoryKey, roomNumber) {
  if (!inventoryKey || !roomNumber) return null;
  return `${inventoryKey}:${roomNumber}`;
}

export function parseCalendarRoomKey(roomValue) {
  if (!roomValue) return { inventoryKey: null, unitKey: null };

  const value = String(roomValue);
  if (value.includes(":")) {
    const [inventoryKey, unitKey] = value.split(":");
    return { inventoryKey, unitKey };
  }

  if (value === "1" || value === "room1") {
    return { inventoryKey: "family-vista", unitKey: value };
  }

  if (value === "2" || value === "4" || value === "room2" || value === "room4") {
    return { inventoryKey: "shared-premium", unitKey: value };
  }

  return { inventoryKey: value, unitKey: value };
}

export function getAvailabilityState(bookedCount, totalRooms) {
  if (bookedCount >= totalRooms) return "booked";
  if (bookedCount > 0) return "almost";
  return "free";
}

export function getInventoryByRoomId(roomId) {
  return getRoomInventoryConfig(roomId);
}
