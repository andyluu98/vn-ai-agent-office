# Hướng dẫn sử dụng — VN AI Agent Office

> Văn phòng ảo 3D nơi bạn **nhìn thấy** các AI agent (do **Claude Code** điều khiển) làm việc, trò chuyện và phối hợp. Bạn tự host trên máy mình.

---

## 1. VN AI Agent Office là gì?

Đây là một web app chạy trên máy bạn (không phải dịch vụ đám mây). Nó gồm 2 phần:

- **Office 3D** (`localhost:3000`): giao diện văn phòng — mỗi agent là một nhân vật ngồi ở bàn riêng.
- **Adapter** (`127.0.0.1:7770`): cầu nối gọi **Claude Code** (`claude -p`) để agent "suy nghĩ" và trả lời.

Đường đi: **Trình duyệt (office) → Adapter → CLI `claude` (Claude Code của bạn)**. Adapter dùng luôn phiên đăng nhập Claude Code sẵn có nên **không cần token riêng**.

## 2. Yêu cầu

1. **Node.js 20+** và **npm 10+**.
2. **Claude Code CLI** — tải tại https://claude.ai/code, đăng nhập (gói Pro/Max) **hoặc** đặt biến `ANTHROPIC_API_KEY` (API trả tiền theo token, không dính giới hạn tuần của gói).
   - Kiểm tra: chạy `claude --version` thấy ra số phiên bản là được.

## 3. Cài đặt & chạy (lần đầu)

```bash
# 1. Cài thư viện
npm install

# 2. Mở 2 cửa sổ terminal:

# Terminal A — adapter (cầu nối Claude Code)
npm run claude-adapter

# Terminal B — office 3D
npm run dev
```

Mở trình duyệt vào **http://localhost:3000**. Adapter đang chạy → app **tự vào thẳng office, không cần gõ gì**. (Nếu adapter chưa chạy, màn hình kết nối hiện ra với URL `http://localhost:7770` điền sẵn — bấm **Kết nối**.)

## 4. Bạn làm được gì trong office?

| Việc | Cách làm |
|---|---|
| **Xem agent làm việc** | Các bàn hiện trong văn phòng 3D; mỗi bàn là 1 agent. Kéo/zoom để xem. |
| **Chat với 1 agent** | Bấm vào agent (hoặc mở panel **TÁC NHÂN** bên phải) → gõ tin nhắn → agent trả lời bằng Claude thật. |
| **Agent tự sinh agent** | Bảo agent **Orchestrator**: *"Tạo team làm web bán hàng"*. Nó tự tạo thêm bàn worker (Frontend, Backend…) — xuất hiện ngay trong phòng. |
| **Đổi giao diện sáng/tối** | Nút 🌙/☀️ ở **góc trên-phải HUD**, hoặc **Studio Settings → Giao diện**. |
| **Kanban / Lịch sử / Phân tích / Kịch bản** | Mở qua các nút HUD (KANBAN BOARD, panel bên phải). |
| **Đổi tên/avatar/tính cách agent** | Bấm chỉnh sửa agent → sửa file IDENTITY/SOUL… (lưu qua adapter). |

## 5. Tuỳ chỉnh danh sách agent (`claude-agents.json`)

Roster agent đọc từ file `claude-agents.json` ở thư mục gốc repo. Mặc định có 8 agent (3 kỹ thuật + 5 văn phòng: Thư ký, Kế toán, Nhân sự, Hành chính, CSKH).

Thêm/sửa agent — mỗi agent là một mục:

```json
{
  "agents": [
    { "id": "marketing", "name": "Marketing", "role": "Marketing", "emoji": "📣",
      "system": "Bạn là chuyên viên Marketing. Soạn nội dung, kế hoạch quảng cáo..." }
  ]
}
```

- `role` là tên hiển thị **và** khoá định tuyến chat — phải **duy nhất**.
- Sau khi sửa file, **khởi động lại adapter** (`npm run claude-adapter`) rồi tải lại trang.
- Mẫu tham khảo: `claude-agents.example.json`.

## 6. Biến môi trường hữu ích

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `CLAUDE_ADAPTER_PORT` | `7770` | Cổng adapter |
| `CLAUDE_ADAPTER_MODEL` | `claude-haiku-4-5-20251001` | Model Claude cho agent |
| `CLAUDE_ADAPTER_MAX_AGENTS` | `12` | Trần số agent (gồm cả agent gốc + agent sinh thêm) |
| `CLAUDE_ADAPTER_AGENT_TTL_MS` | `1800000` | Sau bao lâu (ms) agent sinh-thêm rảnh sẽ bị dọn (agent gốc không bị) |
| `CLAUDE_BIN` | `claude` | Đường dẫn CLI `claude` nếu không có trong PATH |
| `ANTHROPIC_API_KEY` | (trống) | Đặt để `claude` dùng API trả tiền (né giới hạn tuần của gói) |

Xem thêm `docs/claude-code-adapter.md` để biết chi tiết adapter.

## 7. Xử lý sự cố

| Hiện tượng | Nguyên nhân & cách xử |
|---|---|
| Chat trả **502 / "weekly limit"** | Gói Claude của bạn cạn hạn mức tuần. Chờ reset, hoặc đặt `ANTHROPIC_API_KEY` để dùng API. |
| **"Gateway is not connected"** | Adapter chưa chạy hoặc đã tắt. Chạy lại `npm run claude-adapter`. Adapter sống thì bấm Kết nối lại. |
| Khởi động báo **"claude CLI not found"** | Chưa cài Claude Code, hoặc `claude` không trong PATH. Cài tại https://claude.ai/code hoặc đặt `CLAUDE_BIN`. |
| Vào vẫn phải gõ URL | Hiếm — kiểm tra backend đang chọn là **Custom**, URL `http://localhost:7770`. |
| Đổi `claude-agents.json` không thấy agent mới | Phải **khởi động lại adapter** rồi tải lại trang. |

## 8. Backend khác (nâng cao)

Ngoài Claude Code (Custom), app còn hỗ trợ các runtime gốc của dự án thượng nguồn: **OpenClaw**, **Hermes**, **Demo**. Chọn trong màn hình kết nối nếu bạn có các hệ đó. Mặc định và khuyến nghị cho bản này là **Custom (Claude Code)**.

---

_Dựa trên dự án mã nguồn mở Claw3D (MIT) của LukeTheDev, đã Việt hoá và thêm adapter Claude Code._
