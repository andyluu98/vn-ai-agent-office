# Runtime Profiles

VN AI Agent Office hiện xử lý các runtime backend như các named saved profile thay vì một cặp URL/token toàn cục duy nhất.

## Các profile hiện tại

- `openclaw`
- `hermes`
- `demo`
- `local`
- `claw3d`
- `custom`

Mỗi profile lưu URL và token riêng của nó trong Studio settings.

## Ý nghĩa của từng profile

### `openclaw`

Luồng OpenClaw gateway bình thường qua Studio's WebSocket bridge.

Đây là path giàu nhà cung cấp nhất. OpenClaw đã biết cách ngồi trước nhiều upstream model provider, vì vậy VN AI Agent Office nên xử lý nó như một gateway adapter first-class thay vì làm phẳng nó thành `custom`.

URL điển hình:

```text
ws://localhost:18789
```

### `hermes`

Hermes adapter tích hợp sẵn qua cùng gateway-shaped WebSocket flow.

Đây cũng là một runtime path nhận thức nhà cung cấp. Hermes có thể sở hữu cài đặt provider/account của riêng nó sau ranh giới gateway.

URL điển hình:

```text
ws://localhost:18789
```

### `demo`

Demo gateway tích hợp sẵn cho văn phòng không cần framework.

Nếu gateway đó không khả dụng, văn phòng vẫn có thể fallback về agent `main` cục bộ đã được seed để cảnh có thể khám phá thay vì kết thúc trong connect overlay.

URL điển hình:

```text
ws://localhost:18789
```

### `local`

Ranh giới runtime HTTP trực tiếp cho local orchestrator hoặc local model router.

URL điển hình:

```text
http://localhost:7770
```

### `claw3d`

Profile runtime HTTP theo kiểu VN AI Agent Office cho các stack muốn giữ các quy ước transcript và chat của VN AI Agent Office trong khi vẫn sử dụng direct runtime seam.

URL điển hình:

```text
http://localhost:3000/api/runtime/custom
```

### `custom`

HTTP runtime seam chung khi bạn muốn trỏ VN AI Agent Office tới bất kỳ orchestrator boundary tương thích nào.

URL điển hình:

```text
http://localhost:7770
```

## Hợp đồng runtime hiện tại

Direct runtime seam hiện tại kiểm tra:

- `GET /health`
- `GET /state`
- `GET /registry`
- `POST /v1/chat/completions`

Điều đó có nghĩa là `local`, `claw3d` và `custom` là các saved profile first-class ngày nay.

Ngoài các cuộc gọi chat/session thông thường, runtime provider hiện expose một multi-agent message seam chung:

- `agents.message`
- `agents.handoff`

Các method này hiện định tuyến qua mô hình gateway/runtime session hiện có thay vì phát minh transport transcript thứ hai.

## Hợp đồng Multi-Agent Message

`agents.message` hỗ trợ:

- `targetAgentId`
- `message`
- `mode: "direct" | "interval"`
- `sourceAgentId` tùy chọn
- `sourceLabel` tùy chọn
- `cadenceHint` tùy chọn

`agents.handoff` hỗ trợ:

- `targetAgentId`
- `task`
- `context` tùy chọn
- `deliverables` tùy chọn
- `acceptanceCriteria` tùy chọn
- `sourceAgentId` tùy chọn
- `sourceLabel` tùy chọn

Mục đích là giữ một hợp đồng message/handoff ổn định trong khi các runtime adapter khác nhau quyết định cách deliver nó.

## Những gì chưa được kết nối

Đây chưa phải là connection profile first-class trong branch này:

- Anthropic
- Claude Code
- OpenRouter
- các transport gốc provider khác

Các provider đó nên được triển khai như các adapter thực sự, không phải như các nút giả vờ HTTP runtime seam đã hiểu auth gốc provider và event semantics.

Con đường review provider hiện tại nên mượn từ Hermes/OpenClaw wizard flow hiện có khi có thể, nhưng triển khai như VN AI Agent Office-native adapter thay vì hard-coupling trạng thái UI VN AI Agent Office với code connector của dự án khác.

## Tại sao điều này quan trọng cho công việc Multi-Agent

Việc chia tách profile là bước đầu tiên hướng tới:

- trạng thái kết nối đã lưu riêng biệt cho từng runtime
- chat và handoff agent-to-agent qua các backend
- các luồng shared-floor và coworking mà không làm phẳng mọi runtime thành một transport
- các provider adapter tương lai không yêu cầu viết lại trạng thái Studio UI
