# Tích hợp VN AI Agent Office ⇄ vn-one-person-company (vn-opc)

> File tham chiếu cho Claude Code / AI khi muốn tích hợp hoặc mở rộng phần nối
> Office với vn-opc. Đọc file này trước khi sửa code liên quan.

## Mô hình
- **vn-opc = bộ não.** Chạy việc thật (qua MCP `vn-business-os`), giữ **vault**.
- **Office 3D = tấm gương read-only.** Chỉ ĐỌC vault để hiển thị agent đang làm gì.
  Office **KHÔNG** tự gọi họp, **KHÔNG** ghi vào vault, **KHÔNG** gọi MCP của opc.

## ⚠️ Quy tắc bảo mật (BẮT BUỘC khi sửa repo)
- **KHÔNG** hardcode đường dẫn tuyệt đối, tên vault, tên doanh nghiệp thật vào
  bất kỳ file nào commit. Luôn dùng biến môi trường + placeholder (vd `<vault>`,
  `C:/vaults/<TenDN>`).
- `.env` đã gitignore — không commit. Không đưa API key/token vào repo.
- Khi viết docs/spec, dùng placeholder thay cho dữ liệu thật.

## Cấu hình (đặt trong `.env`, xem `.env.example`)
| Biến | Ý nghĩa |
|---|---|
| `CLAUDE_ADAPTER_DEPARTMENTS_DIR` | `<path>/vn-one-person-company/departments` — adapter nạp roster agent theo phòng ban. |
| `VN_OS_DEFAULT_VAULT` | Đường dẫn vault vn-opc — `opc-mirror` đọc task ở đây. vn-opc thường đã `setx` sẵn. |

## Chạy (3 tiến trình)
```bash
npm run dev             # Office 3D → http://localhost:3000/office
npm run claude-adapter  # :7770 — nạp agent phòng ban, cần Claude Code đăng nhập
npm run opc-mirror      # bridge: vault → office task-store
```
Office: bấm Kết nối → Custom → `http://127.0.0.1:7770`.
Kiểm tra nhanh: `npm run doctor` (mục **OPC Mirror**).

## Cơ chế mirror (vault → office)
`opc-mirror` poll `<vault>/02-Tasks/<task>/` mỗi ~2.5s; suy trạng thái từ FILE có mặt:

| File có mặt | Trạng thái |
|---|---|
| `00-brief` | created |
| `01-routing` | routed/ready |
| `03-clarification` (chưa `-answered`) | awaiting_clarification |
| `03b-research-findings` **và chưa** `07-decision-report` | **MEETING (đang họp)** |
| `07-decision-report` (chưa `08`) | awaiting_decision |
| `08-execution-plan` + có file trong `03-Outputs/<task>` | done |

- **Phòng ban** đọc từ `01-routing.md`: dòng `**Departments:** 07-marketing, 03-finance, …`
  (mã khớp tên thư mục trong `departments/`).
- **Đang họp** (`03b` && !`07`): mỗi phòng ban → **trưởng phòng** vào phòng họp 3D
  (card `in_progress`); thành viên còn lại → góp ý tại bàn (xem `meeting-commenters`).
- Có `07` → card `done` "📋 Kết luận".
- Mirror **sở hữu** phòng họp: archive mọi card `in_progress` không còn mong muốn
  → agent tự về chỗ khi họp kết thúc.

## Bản đồ file (nơi sửa)
| File | Vai trò |
|---|---|
| `server/opc-mirror/vault-task-reader.js` | Đọc task folder → `{status, departments, meetingActive, hasDecisionReport}`. |
| `server/opc-mirror/department-agents.js` | Map phòng ban→agent (`/agents`); chọn trưởng phòng (`headsForDepartments`). |
| `scripts/opc-mirror.mjs` | Vòng poll + đồng bộ task-store (upsert/archive card). |
| `src/features/retro-office/core/meeting-commenters.ts` | Thành viên nào góp ý từ ngoài. |
| `src/app/api/task-store/route.ts` | Kho card của office (GET ẩn card đã archive). |
| `src/features/retro-office/RetroOffice3D.tsx` | Cảnh 3D tĩnh (staticTick, phòng họp, pad phòng ban, bong bóng góp ý). |

## Cách mở rộng (gợi ý)
- **Hiện pha "đang nghiên cứu"** (trước `03b`): thêm nhánh trong `vault-task-reader`
  + hiệu ứng riêng trong scene.
- **Cho cả phòng vào họp** thay vì 1 trưởng phòng: trong `opc-mirror.mjs` đổi
  `headsForDepartments` → `agentsForDepartments`.
- **Trạng thái khác** (chờ CEO duyệt…): map thêm status → hiệu ứng agent.

## vn-opc MCP (chỉ tham khảo — Office KHÔNG gọi)
`vn-business-os`: `vn_run`, `vn_meeting(departments, task_folder)`, `vn_approve`,
`vn_execute`, `vn_status` (chỉ cấp công ty, không đủ chi tiết để vẽ từng agent →
vì vậy ta đọc vault thay vì gọi `vn_status`).

## Kiểm thử
- Unit: `tests/unit/opc-vault-task-reader.test.ts`, `opc-department-agents.test.ts`,
  `meeting-commenters.test.ts`.
- `npm run doctor` để kiểm tra điều kiện tích hợp trên máy hiện tại.
