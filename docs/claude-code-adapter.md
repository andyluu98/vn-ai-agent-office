# Claude Code Adapter

Adapter này là một HTTP runtime "custom" (`server/claude-code-runtime-adapter.js`) cho phép VN AI Agent Office được điều khiển bởi Claude Code headless (`claude -p`). Thay vì kết nối với OpenClaw hay Hermes, văn phòng giao tiếp với CLI `claude` chạy cục bộ — mỗi agent trong roster tương ứng với một lần gọi `claude -p` riêng biệt.

## Khởi động adapter

```bash
npm run claude-adapter
```

Theo mặc định, adapter lắng nghe tại `http://127.0.0.1:7770`. Không cần khởi động thêm process nào khác — bản thân lệnh này đủ để Studio kết nối.

## Biến môi trường

| Biến | Mặc định | Mô tả |
|---|---|---|
| `CLAUDE_ADAPTER_PORT` | `7770` | Cổng HTTP adapter lắng nghe |
| `CLAUDE_ADAPTER_HOST` | `127.0.0.1` | Địa chỉ bind của adapter |
| `CLAUDE_ADAPTER_MODEL` | `claude-haiku-4-5-20251001` | Model Claude mặc định cho tất cả agent |
| `CLAUDE_BIN` | `claude` (từ PATH) | Đường dẫn tới CLI `claude` nếu không có trong PATH |
| `CLAUDE_ADAPTER_ROSTER` | `<cwd>/claude-agents.json` | Đường dẫn tới file JSON cấu hình roster |
| `CLAUDE_ADAPTER_VERSION` | `cli` | Chuỗi version runtime hiển thị trong `GET /state` |

## Endpoint

Adapter triển khai bốn endpoint mà direct runtime seam của VN AI Agent Office yêu cầu:

### `GET /health`

Trả về trạng thái healthy của adapter.

```json
{ "status": "ok" }
```

### `GET /state`

Trả về trạng thái runtime và danh sách agent đang active. Mỗi agent trong roster xuất hiện dưới key `active` với model được gán.

```json
{
  "identity": { "name": "Orchestrator", "role": "Orchestrator", "model_id": "claude-haiku-4-5-20251001" },
  "runtime": {
    "name": "Claude Code",
    "version": "cli",
    "vendor": "Anthropic",
    "status": "healthy",
    "active_model": "claude-haiku-4-5-20251001"
  },
  "active": {
    "Orchestrator": "claude-haiku-4-5-20251001",
    "Coder": "claude-haiku-4-5-20251001",
    "Researcher": "claude-haiku-4-5-20251001"
  }
}
```

### `GET /registry`

Trả về danh sách model khả dụng.

```json
{
  "models": {
    "claude-haiku-4-5-20251001": { "name": "claude-haiku-4-5-20251001", "provider": "anthropic" }
  }
}
```

### `POST /v1/chat/completions`

Endpoint tương thích OpenAI (non-streaming). Nhận `model`, `messages` và `stream` (bỏ qua — luôn non-streaming). Adapter chạy `claude -p` với system prompt của agent phù hợp và trả về phản hồi.

Request body:

```json
{
  "model": "Orchestrator",
  "messages": [{ "role": "user", "content": "Tóm tắt công việc hôm nay." }]
}
```

Response:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "..." },
    "finish_reason": "stop"
  }]
}
```

## Roster agent

Roster mặc định gồm ba agent:

| id | name | role | Emoji |
|---|---|---|---|
| `orchestrator` | Orchestrator | Orchestrator | 🧭 |
| `coder` | Coder | Coder | 💻 |
| `researcher` | Researcher | Researcher | 🔎 |

### Tuỳ chỉnh roster

Tạo file `claude-agents.json` ở thư mục gốc của repo (hoặc trỏ `CLAUDE_ADAPTER_ROSTER` tới một đường dẫn khác). Xem `claude-agents.example.json` để biết định dạng:

```json
{
  "agents": [
    { "id": "pm", "name": "PM", "role": "ProductManager", "emoji": "📋", "system": "You are the Product Manager agent. Plan and prioritize." },
    { "id": "backend", "name": "Backend", "role": "Backend", "emoji": "⚙️", "system": "You are the Backend agent. Implement APIs and data." },
    { "id": "frontend", "name": "Frontend", "role": "Frontend", "emoji": "🎨", "system": "You are the Frontend agent. Build UI." },
    { "id": "qa", "name": "QA", "role": "QA", "emoji": "🧪", "system": "You are the QA agent. Test and report defects." }
  ]
}
```

Các trường:

- `id` — định danh nội bộ (dùng trong routing).
- `name` — tên hiển thị trong văn phòng.
- `role` — key dùng trong `GET /state` và làm `model` field khi Studio gọi chat.
- `emoji` — biểu tượng hiển thị trên desk (tùy chọn).
- `system` — system prompt gửi tới `claude -p` cho agent này.

Roster có thể mở rộng tuỳ ý — thêm bao nhiêu agent cũng được. Mỗi agent trong roster trở thành một desk riêng trong văn phòng.

## Kết nối trong Studio

1. Khởi động adapter: `npm run claude-adapter`
2. Khởi động Studio: `npm run dev`
3. Mở `http://localhost:3000`
4. Trong màn hình kết nối, chọn **Custom backend** (hoặc **Local runtime**)
5. Nhập URL: `http://127.0.0.1:7770`
6. Nhấn **Connect**

Trong production, đặt biến môi trường:

```bash
CUSTOM_RUNTIME_ALLOWLIST=127.0.0.1
```

để Studio cho phép fetch tới địa chỉ adapter.

## Lưu ý và giới hạn

- **Giới hạn weekly usage:** CLI `claude` có thể trả về HTTP 502 khi đã chạm giới hạn sử dụng hàng tuần của Anthropic. Chat sẽ hoạt động trở lại khi giới hạn được reset. Đây là giới hạn từ phía Anthropic, không phải lỗi của adapter.
- **Non-streaming:** Endpoint `/v1/chat/completions` luôn trả về response đầy đủ (không phải stream), bất kể trường `stream` trong request.
- **Mỗi request là độc lập:** Adapter chạy `claude -p` mới cho mỗi request, không duy trì session hay memory giữa các lần gọi.
- **Adapter chỉ dành cho cục bộ:** Theo mặc định bind trên `127.0.0.1`. Không expose ra mạng công khai mà không thêm lớp xác thực.

---

## Dynamic Agent Registry (Phase 6)

Adapter hỗ trợ thêm/xóa agent tại runtime thông qua một **AgentRegistry** mutable, seeded từ roster tĩnh khi khởi động. Agent được thêm qua endpoint REST hoặc tự động từ **spawn directive** trong reply của lead agent.

### Biến môi trường bổ sung

| Biến | Mặc định | Mô tả |
|---|---|---|
| `CLAUDE_ADAPTER_MAX_AGENTS` | `5` | Tổng số agent tối đa (kể cả seed). Thêm vượt cap → 409. |
| `CLAUDE_ADAPTER_AGENT_TTL_MS` | `1800000` | TTL idle (ms) cho runtime agent. Seed agent không bị prune. |

### Endpoint quản lý agent

#### `GET /agents`

Trả về danh sách tất cả agent đang active (seed + runtime).

```json
{ "agents": [{ "id": "orchestrator", "name": "Orchestrator", "role": "Orchestrator", "seed": true, ... }] }
```

#### `POST /agents`

Thêm một runtime agent mới. Body: `{ "name", "role", "system"?, "emoji"? }`.

- `201` — agent tạo thành công.
- `409` — cap đã đầy hoặc role trùng.

```bash
curl -X POST http://127.0.0.1:7770/agents \
  -H "Content-Type: application/json" \
  -d '{"name":"Frontend","role":"Frontend","system":"You are the Frontend agent."}'
```

#### `DELETE /agents/:id`

Xóa agent theo `id`. Seed agent có thể bị xóa qua endpoint này (nhưng sẽ không bao giờ bị prune tự động).

- `200 {"removed":true}` — xóa thành công.
- `404` — không tìm thấy.

```bash
curl -X DELETE http://127.0.0.1:7770/agents/runtime-1
```

### Spawn directive

Lead agent (Orchestrator) có thể yêu cầu tạo worker agent mới bằng cách thêm một dòng đặc biệt vào cuối reply:

```
[[SPAWN: {"role":"RoleName","system":"Brief description of the agent."}]]
```

**Quy tắc:**
- Adapter parse directive sau mỗi chat completion thành công.
- JSON hợp lệ → agent được thêm vào registry (nếu còn slot và role chưa tồn tại).
- JSON không hợp lệ → directive được giữ nguyên trong text (không bị xóa).
- Directive hợp lệ được xóa khỏi text trả về cho user; một ghi chú ngắn được thêm vào cuối reply.
- Nếu cap đã đầy → agent không được tạo, reply ghi chú lý do.

**Ví dụ reply của Orchestrator:**

```
Tôi sẽ phân công việc này. Hãy để tôi tạo thêm một agent chuyên trách.
[[SPAWN: {"role":"DataAnalyst","system":"You are the Data Analyst agent. Analyze data and produce insights."}]]
```

Reply mà user thấy:

```
Tôi sẽ phân công việc này. Hãy để tôi tạo thêm một agent chuyên trách.

_Đã tạo bàn: DataAnalyst._
```

Agent `DataAnalyst` xuất hiện ngay trong `GET /state` và `GET /agents`.

### Idle prune

Adapter tự động xóa runtime agent (không phải seed) khi chúng không hoạt động quá `CLAUDE_ADAPTER_AGENT_TTL_MS` (mặc định 30 phút). Prune xảy ra tại đầu mỗi request chat. Seed agent không bao giờ bị prune.
