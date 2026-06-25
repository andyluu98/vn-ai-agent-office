import type { DistrictZone } from "@/features/retro-office/core/district";
import { snap } from "@/features/retro-office/core/geometry";

// Meeting room canvas rect (left side of the office, full depth). Summoned
// agents glide here to sit around the central table.
export const MEETING_ROOM_RECT: DistrictZone = {
  minX: 30,
  maxX: 560,
  minY: 30,
  maxY: 690,
};

export type MeetingSeat = { x: number; y: number; facing: number };

/**
 * Evenly-spaced seats arranged in a ring around the meeting room centre, all
 * facing inward (toward the conference table). Deterministic — participant i
 * always maps to seat i for a given count. Seats stay well inside the room.
 */
export const computeMeetingSeats = (
  room: DistrictZone,
  count: number,
): MeetingSeat[] => {
  if (count <= 0) return [];
  const cx = (room.minX + room.maxX) / 2;
  const cy = (room.minY + room.maxY) / 2;
  const halfX = (room.maxX - room.minX) / 2;
  const halfY = (room.maxY - room.minY) / 2;
  // Ring radius: a fraction of the smaller half-extent so seats never leave the
  // room even for the largest expected meeting.
  const radius = Math.min(halfX, halfY) * 0.62;
  const seats: MeetingSeat[] = [];
  for (let i = 0; i < count; i += 1) {
    // Start at the top and go clockwise; offset keeps seat 0 off the exact edge.
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const x = snap(cx + radius * Math.cos(angle));
    const y = snap(cy + radius * Math.sin(angle));
    seats.push({
      x,
      y,
      // Face the room centre (atan2(dx, dy) convention used by the scene).
      facing: Math.atan2(cx - x, cy - y),
    });
  }
  return seats;
};
