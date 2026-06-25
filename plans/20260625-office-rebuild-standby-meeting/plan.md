# Office Rebuild — Standby + Departments + Meeting Room (2026-06-25)

User-approved. "Build mới, không fix nữa." 3 lỗi cấu trúc đã xác minh:
1. Agent chạy loạn — `interactionTarget="standby"` chỉ miễn va chạm, KHÔNG ghim; slot tính từ list sống đã lọc người-đang-họp → reshuffle liên tục.
2. Không thấy phòng ban — biển tên có render nhưng nhỏ, không có sàn/khối phân khu.
3. Không thấy phòng họp — không có khối hình (sàn/tường/bàn/ghế), chỉ có toạ độ ghế.

## Approach: ghế cố định, đặt trước, đóng băng

Hệ toạ độ: `toWorld(cx,cy)=[cx*0.018-16.2,0,cy*0.018-16.2]`. Sàn 0..1800 × 0..720.
GIỮ NGUYÊN zones (MEETING_ROOM_ZONE 0..540×0..320, STANDBY 560..1800×0..720) để không phá seat-inference + clamp + nav grid.

## Phases

### P1 — Stable seating module (TDD) — `core/standby-seating.ts`
`computeStandbySeating(allDeptAgents, zone)` → `{ seats: Map<id,Seat>, clusters: ClusterBox[] }`
- Sort phòng ban theo `department` code; trong phòng ban sort theo `id`. → slot ổn định, KHÔNG phụ thuộc thứ tự input.
- Tính trên TOÀN BỘ dept agent (KHÔNG loại người đang họp) → ghế được giữ chỗ vĩnh viễn, summon không dồn ai.
- ClusterBox kèm width/height + agentCount để vẽ sàn pad.
- Test: ổn định khi đổi thứ tự input; ổn định khi 1 agent vắng (meeting); trong zone; không trùng toạ độ; 12 phòng ban → 12 cluster.

### P2 — Freeze trong tick (RetroOffice3D)
- Dùng seat map (useMemo trên full dept roster) thay `resolveStandbyTarget` ở các nhánh standby (1400, 1546, 1683, 1712).
- Movement loop: standby + cách ghế ≤8px → snap thẳng vào ghế, state "standing", path=[]. Không re-path. Đứng im tuyệt đối.

### P3 — Dept zones nhìn thấy — geometry component
- Mỗi cluster: sàn pad màu (12-màu palette) + biển tên to hơn. Render trong scene.

### P4 — Meeting room nhìn thấy — geometry component
- Sàn riêng + 4 tường thấp (mở mặt trước) + bàn họp dài + ghế tại MEETING_OVERFLOW_LOCATIONS. Render trong scene.

### P5 — Verify
- typecheck + build + full test (baseline: 5 fail pre-existing). User xác nhận thị giác.

## Success
- Agent đứng im 100% (test ổn định slot + freeze). Thấy rõ 12 ô phòng ban có sàn+biển. Thấy rõ phòng họp có bàn/ghế/tường. Summon → vào họp → về đúng ghế cũ.
