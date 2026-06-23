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
