# Tích hợp vn-one-person-company → VN AI Agent Office (PLAN)

> Mục tiêu (user-confirmed): office hiển thị các agent phòng ban của `vn-one-person-company`, đúng tên + chức năng; xem agent họp/trao đổi trong phòng họp. Tất cả qua Claude Code, trong repo này.

## Quyết định đã chốt
- **Nguồn agent:** đọc từ `vn-one-person-company/departments/**/agents/*.md` (local). Cấu hình đường dẫn qua env `CLAUDE_ADAPTER_DEPARTMENTS_DIR`.
- **Cấp hiển thị:** mỗi AGENT = 1 nhân vật (hiện ~33 agent), gom nhóm theo phòng ban.
- **Quản lý:** đọc-chỉ (read-only mirror). Thêm/sửa/xoá = sửa file `.md` → office đọc lại khi restart adapter. KHÔNG ghi ngược.
- **Vị trí:** toàn bộ trong repo `vn-ai-agent-office`.

## Định dạng agent (.md) — đã khảo sát
Frontmatter: `id`, `name_vn` (tên hiển thị), `department` (vd "01-governance"), `emoji`, `expertise[]`, `deliverables[]`, `seniority`, `temperature`. Body có `## Vai trò` (đoạn mô tả = system prompt). `department.yaml` mỗi phòng: `code`, `name_vn` (tên phòng), `agents[]`, `default_speaker`.

## Lớp 1 — Department loader (làm trước, TDD)  ← FOUNDATION
- **L1.1** `server/claude-code-adapter/department-loader.js`:
  - `loadDepartmentRoster(dir) -> Array<agent>|null`: quét `dir/**/agents/*.md`. Với mỗi file: parse frontmatter (đọc bằng regex YAML đơn giản, không thêm dep — chỉ cần `id`, `name_vn`, `emoji`, `department`), lấy `## Vai trò` (hoặc toàn body nếu không có) làm `system`. Đọc `department.yaml` mỗi phòng để lấy `name_vn` (tên phòng) cho nhóm.
  - Trả agent: `{ id, name: name_vn, role: <unique label>, emoji, system, department: <dept code>, departmentName: <dept name_vn> }`. **role phải DUY NHẤT** (office key theo role) — nếu trùng name_vn, thêm hậu tố " · <dept>". 
  - Trả `null` nếu dir không tồn tại/không có agent (để fallback).
- **L1.2** `roster.js` `loadRoster()`: thêm precedence cao nhất — nếu `CLAUDE_ADAPTER_DEPARTMENTS_DIR` set & `loadDepartmentRoster` trả danh sách → dùng nó. Else giữ logic cũ (runtime file > seed > DEFAULT_ROSTER). Mark `seed: true` (không bị prune).
- **L1.3** Đảm bảo **seed không bị cap**: 33 agent nạp làm seed phải vào hết bất kể `CLAUDE_ADAPTER_MAX_AGENTS` (cap chỉ chặn ADD runtime). Verify trong registry.
- **L1.4** `.env.example`: `CLAUDE_ADAPTER_DEPARTMENTS_DIR=` + ví dụ trỏ tới `.../vn-one-person-company/departments`.
- **Tiêu chí Lớp 1:** set env trỏ tới departments, restart adapter → `GET /agents` trả ~33 agent đúng tên (name_vn) + emoji; office hiện đúng số agent với đúng tên/chức năng; chat 1 agent dùng đúng system prompt; ra lệnh → agent họp (Phase 6 sẵn có) chạy.

## Lớp 2 — Thiết kế lại layout: khu CHỜ + phòng HỌP (user-confirmed: cách 1, văn phòng rộng hơn)
**Quyết định:** 1 văn phòng, 2 khu. **Khu chờ** chứa toàn bộ ~33 agent (gom theo phòng ban). **Phòng họp** đủ rộng để thấy rõ. Văn phòng chính chỉ "tập trung" hiển thị: agent được gọi → vào phòng họp; còn lại đứng ở khu chờ (sẵn sàng). Lấy từ roster local, KHÔNG dùng cơ chế remote.

### Khảo sát chốt (file/line cụ thể)
- Toạ độ: `core/constants.ts` CANVAS 1800×1800, SCALE 0.018; `core/district.ts` LOCAL_OFFICE 1800×720. `geometry.ts toWorld()`. **Không đổi CANVAS** (nav-grid `navigation.ts:71-72` GRID_COLS/ROWS phụ thuộc → rủi ro vỡ pathfinding). Làm trong vùng sẵn có.
- Ghế họp: `navigation.ts:308-344` infer từ chair trong vùng HARDCODE x≤290,y≤235 → **nới vùng này để phòng họp rộng hơn** + thêm `MEETING_OVERFLOW_LOCATIONS` (487).
- `resolveMeetingTarget` (RetroOffice3D:942) gán ghế theo participant order.
- Partition: `OfficeScreen orchestrationParticipants` (3161) = agent có task in_progress; `RetroOffice3D explicitMeetingHold` (1077). Agent KHÔNG được gọi hiện đi desk/roam → cần đổi sang **đứng khu chờ**.
- `department` CHƯA xuyên suốt: thêm vào `OfficeAgent` type (`retro-office/core/types.ts`), provider `buildSyntheticAgents` (`custom/provider.ts:201`), và `/state` adapter phải kèm department mỗi agent.

### Các bước (mỗi bước user xem + góp ý)
- **2A — Thread `department` xuyên suốt:** `/state` adapter trả thêm `departmentsByRole` (role→{department,departmentName}); provider `buildSyntheticAgents` đọc → gắn vào agent; thêm `department?` vào `OfficeAgent`. (Nền tảng cho gom nhóm.)
- **2B — Phân vùng chờ/họp:** định nghĩa `STANDBY_AREA_ZONE` (trong vùng local hiện có); agent KHÔNG summoned → `resolveStandbyTarget(agent)` đứng ở khu chờ (gom theo department); agent summoned → phòng họp. Văn phòng chính do đó chỉ thấy người họp + người chờ ở khu riêng.
- **2C — Phòng họp rộng hơn:** nới vùng infer ghế họp + tăng số ghế để thấy rõ nhóm họp.
- **2D — Gom cụm + nhãn phòng ban ở khu chờ** (polish, lặp theo mắt nhìn).
- Rủi ro: nav-grid gắn với kích thước office (giữ CANVAS, làm trong vùng); layout cần vài vòng chỉnh theo phản hồi thị giác.

## Ràng buộc
- Adapter: Node built-in, không thêm dep (parse YAML frontmatter bằng regex đơn giản — chỉ vài field). File < 200 LOC. TDD cho loader.
- Read-only: không ghi ngược vào departments. Không phá backend khác / Phase 1-6.
- Test giữ baseline: chỉ 5 fail pre-existing upstream.

## Câu hỏi mở (hỏi lại nếu cần khi làm Lớp 2)
1. 33 agent có quá đông màn hình không? Nếu rối, có thể mặc định chỉ hiện default_speaker mỗi phòng (12), bấm phòng để xem chi tiết agent. Quyết ở Lớp 2.
2. Vault thật (Obsidian) của doanh nghiệp khác bản template repo? Hiện đọc từ repo departments/; nếu sau muốn đọc từ vault tuỳ biến → đổi env path.
