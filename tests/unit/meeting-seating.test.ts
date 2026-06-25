import { describe, expect, it } from "vitest";
import {
  computeMeetingSeats,
  MEETING_ROOM_RECT,
} from "@/features/retro-office/core/meeting-seating";

describe("computeMeetingSeats", () => {
  it("returns exactly the requested number of seats", () => {
    expect(computeMeetingSeats(MEETING_ROOM_RECT, 0)).toHaveLength(0);
    expect(computeMeetingSeats(MEETING_ROOM_RECT, 4)).toHaveLength(4);
    expect(computeMeetingSeats(MEETING_ROOM_RECT, 8)).toHaveLength(8);
  });

  it("places every seat inside the meeting room", () => {
    const seats = computeMeetingSeats(MEETING_ROOM_RECT, 8);
    for (const seat of seats) {
      expect(seat.x).toBeGreaterThanOrEqual(MEETING_ROOM_RECT.minX);
      expect(seat.x).toBeLessThanOrEqual(MEETING_ROOM_RECT.maxX);
      expect(seat.y).toBeGreaterThanOrEqual(MEETING_ROOM_RECT.minY);
      expect(seat.y).toBeLessThanOrEqual(MEETING_ROOM_RECT.maxY);
    }
  });

  it("gives distinct seats (no two participants share a spot)", () => {
    const seats = computeMeetingSeats(MEETING_ROOM_RECT, 8);
    const keys = new Set(seats.map((s) => `${Math.round(s.x)},${Math.round(s.y)}`));
    expect(keys.size).toBe(seats.length);
  });

  it("is deterministic — same input yields identical output", () => {
    const a = computeMeetingSeats(MEETING_ROOM_RECT, 6);
    const b = computeMeetingSeats(MEETING_ROOM_RECT, 6);
    expect(b).toEqual(a);
  });

  it("seats face the room center", () => {
    const seats = computeMeetingSeats(MEETING_ROOM_RECT, 4);
    const cx = (MEETING_ROOM_RECT.minX + MEETING_ROOM_RECT.maxX) / 2;
    const cy = (MEETING_ROOM_RECT.minY + MEETING_ROOM_RECT.maxY) / 2;
    for (const seat of seats) {
      const expected = Math.atan2(cx - seat.x, cy - seat.y);
      expect(Math.abs(seat.facing - expected)).toBeLessThan(1e-6);
    }
  });
});
