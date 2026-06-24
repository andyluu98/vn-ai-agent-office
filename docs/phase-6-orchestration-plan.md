# Phase 6 — Autonomous Orchestration + Kanban Dashboard (PLAN)

> **Trạng thái:** Đang triển khai. Đây là plan sống để bất kỳ phiên/máy nào tiếp tục đúng mạch.
> Đọc cùng: `docs/claude-code-adapter.md`, `docs/huong-dan-su-dung.md`.

## Mục tiêu (user-confirmed)

Người dùng **ra lệnh từ Claude Code/terminal** → agent **Orchestrator** nhận → tự bẻ nhiệm vụ thành **task ghi lên Kanban (dashboard)** → các agent **làm lần lượt / được điều phối** (mỗi bước 1 lần gọi `claude -p`) → cập nhật trạng thái task trên bảng → người dùng **xem trực tiếp trong văn phòng 3D** (agent họp, bong bóng thoại). Kanban = bảng để AI tự ghi việc & làm, người dùng theo dõi.

## Hạ tầng sẵn có (tái dùng — KHÔNG dựng lại)

- **Kho task bền**: `src/lib/tasks/shared-store.ts` (`listSharedTasks`, `upsertSharedTask`, `archiveSharedTask`) + API `src/app/api/task-store/route.ts` (GET/PUT/DELETE). Lưu ra file, sống qua restart.
- **Mô hình task**: `src/features/office/tasks/types.ts` → `TaskBoardCard { id, title, description, status: todo|in_progress|blocked|review|done, source, assignedAgentId, notes[], runId, ... }`.
- **Bảng Kanban UI**: `TaskBoardPanel` + `useTaskBoardController` đã render `cardsByStatus` từ shared-store (tab "Kanban" panel phải). **Đã chạy được, chỉ chưa lộ rõ.**
- **Adapter Claude Code**: `server/claude-code-adapter/` — registry agent động, `POST /v1/chat/completions` (chat 1 agent), `POST /agents` (sinh), `POST /agents/remove`.
- **Nút Kanban 3D** hiện mở nhầm prompt "cài skill TASK-MANANGER" của OpenClaw (`OfficeScreen.tsx onKanbanInteract → setKanbanInstallPromptOpen`). Cần trỏ về bảng thật.

## Kiến trúc Phase 6

```
Claude Code / terminal
  │  npm run office-command "nhiệm vụ..."   (hoặc POST /command tới adapter)
  ▼
Adapter: Orchestrator decompose (1 lần claude -p, output JSON danh sách task)
  │  → ghi từng task vào /api/task-store (PUT)  [status: todo, assignedAgentId]
  ▼
Execution loop (trong adapter, có cap đồng thời sẵn = MAX_CONCURRENT)
  │  mỗi task: todo → in_progress → gọi agent (claude -p) → done + note kết quả
  ▼
Kanban dashboard (office) poll /api/task-store → hiển thị live
3D office → agent đang làm sáng "đang chạy"; (Mốc 2) tụ họp + bong bóng thoại
```

**Kênh lệnh:** adapter thêm `POST /command { goal }`. Một script `npm run office-command "..."` POST tới đó. (Người dùng ra lệnh từ Claude Code = chạy script này, hoặc nhờ Claude Code chạy.)

**Vì sao adapter giữ vòng điều phối, không phải browser:** adapter đã có Node + spawn `claude` + concurrency cap; browser chỉ hiển thị. Giữ "não" ở adapter = đơn giản, không phụ thuộc tab mở.

## Cột mốc (mỗi mốc chạy + xem được)

### Mốc 1 — Bộ não + Kanban sống  ← LÀM TRƯỚC
- **M1.1** Shared-store client cho adapter: helper Node gọi `PUT/GET http://localhost:3000/api/task-store` (qua biến `OFFICE_STUDIO_URL`, default `http://localhost:3000`). TDD với fetch stub.
- **M1.2** Orchestrator decompose: `decomposeGoal(goal, runner) -> Task[]`. Prompt yêu cầu Claude trả JSON `[{title, description, role}]`. Parse an toàn (brace-balanced, như spawn-directive). Map `role`→`assignedAgentId` theo registry; role lạ → Orchestrator.
- **M1.3** Endpoint `POST /command { goal }` trong handler: gọi decompose → ghi mỗi task lên task-store (status todo) → trả `{ created: n, taskIds }`. Khởi động vòng thực thi nền.
- **M1.4** Execution loop: lấy task todo theo thứ tự → set in_progress (PUT) → gọi agent qua runner (system = system của agent + mô tả task) → set done + append note kết quả (hoặc blocked nếu lỗi). Tôn trọng MAX_CONCURRENT.
- **M1.5** CLI `scripts/office-command.mjs` + npm script `office-command`. Đọc goal từ argv, POST `/command`, in kết quả + link xem bảng.
- **M1.6** UI: nút Kanban 3D + nút "KANBAN BOARD" mở thẳng `TaskBoardPanel` (bỏ prompt cài skill cho runtime custom). Bảng poll task-store đã có → tự cập nhật.
- **Tiêu chí Mốc 1:** chạy `npm run office-command "lên kế hoạch landing bán khoá học"` → thấy N task hiện trên Kanban, chuyển todo→in_progress→done, mỗi task có ghi chú kết quả từ Claude. Agent đang làm sáng "đang chạy" trong office.

### Mốc 2 — Diễn hoạt 3D cuộc họp  ✅ thiết kế chốt
**Tái dùng cơ chế meeting-hold + speech-bubble đã có** (đã chạy tốt cho standup), kích hoạt từ task activity — KHÔNG dựng hệ animation mới.

Phát hiện hạ tầng (RetroOffice3D.tsx):
- Gom/giữ avatar ở khu họp: `explicitMeetingHold = standupActive && meetingParticipants.has(agent.id)` (dòng ~1066) → `resolveMeetingTarget(agentId)` đặt avatar vào ghế họp.
- Bong bóng thoại per-agent: render ở ~5737, nuôi từ `standupSpeechTextByAgentId` (khi standup in_progress) hoặc `speechTextByAgentId`/`speechAgentIds` (từ feedEvents).
- `taskBoard` (OfficeScreen) đã có `cardsByStatus` + `assignedAgentId` + poll task-store live.

**Triển khai:**
- **M2.1** Trong OfficeScreen, từ `taskBoard.cardsByStatus` suy ra: `orchestrationMeetingActive` (true khi có ≥1 task `in_progress`), `orchestrationParticipants: Set<agentId>` (assignedAgentId của task in_progress), `orchestrationSpeechByAgentId: Record<agentId,string>` (= title task đang làm; task vừa done → "✓ <title>" hiện ngắn). agentId = role string (khớp office agents).
- **M2.2** Truyền 3 giá trị này xuống `RetroOffice3D`. Mở rộng `explicitMeetingHold` thành `(standupActive && meetingParticipants.has(id)) || (orchestrationMeetingActive && orchestrationParticipants.has(id))`. Mở rộng nguồn bong bóng: khi orchestration meeting active, agent trong participants hiện `orchestrationSpeechByAgentId[id]`. Giữ nguyên hành vi standup.
- **M2.3** Banner nhỏ "🟢 Đang họp — N việc đang chạy" trên HUD khi `orchestrationMeetingActive`.
- **M2.4** Khi hết task in_progress → thả hold, avatar về bàn (cơ chế cũ tự lo khi `explicitMeetingHold` về false).
- **Tiêu chí Mốc 2:** chạy `npm run office-command "..."` → các agent được giao việc **đi về khu họp**, hiện **bong bóng** = việc đang làm; xong việc thì giải tán về bàn. Banner "Đang họp" hiện trong lúc chạy.

### Mốc 3 — Cộng tác sâu
- Orchestrator điều phối nhiều lượt: agent đọc kết quả nhau, phản biện, handoff; lead tổng hợp.
- Chặn: số lượt tối đa / task, tổng token; dừng khi hội tụ.

## Ràng buộc
- Node built-in cho adapter (không thêm dep). File < 200 LOC. TDD cho code mới.
- Mỗi bước gọi `claude -p` tốn quota — execution loop phải có cap (tái dùng `CLAUDE_ADAPTER_MAX_CONCURRENT`) + giới hạn số task/lệnh (vd `CLAUDE_ADAPTER_MAX_TASKS_PER_COMMAND`, default 8).
- Giữ tên/khoá protocol; không phá backend khác.
- Test giữ baseline: chỉ 5 fail pre-existing upstream.

## Câu hỏi mở
1. Khi `claude` dính weekly-limit, execution loop nên đánh task `blocked` kèm lý do (không retry vô hạn) — xác nhận hành vi.
2. Có cần nút "Dừng tất cả" trên Kanban để huỷ vòng đang chạy không? (đề xuất: có, ở Mốc 1.6 nếu nhanh, không thì Mốc 3.)
