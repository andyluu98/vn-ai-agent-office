# Đóng gói thành app desktop (.exe / .dmg) + tương thích Claude Code

> Tư vấn kỹ thuật: biến VN AI Agent Office thành phần mềm cài đặt cho Windows (.exe) / macOS (.dmg), và nó chạy với Claude Code (Claude Desktop) thế nào.

## TL;DR (khuyến nghị)

- **Khả thi: CÓ.** Cách phù hợp nhất là **Electron** (không phải Tauri) — vì app này cần **Node chạy nền** (server Studio + adapter), mà Electron đã bọc sẵn Node.
- **Chạy với Claude Code: CÓ**, miễn máy người dùng **đã cài Claude Code và đăng nhập** (hoặc có `ANTHROPIC_API_KEY`). App **không bundle được** Claude Code (đó là sản phẩm của Anthropic, đăng nhập là của người dùng) — nó gọi `claude` trên máy.
- **Cảnh báo lớn cho macOS:** app GUI mở từ Finder/Dock **không kế thừa PATH của terminal** → có thể **không tìm thấy `claude`**. Phải xử lý PATH (xem mục 4). Đây là lỗi hay gặp nhất.

---

## 1. Vì sao Electron, không phải Tauri?

App này KHÔNG phải web tĩnh. Nó gồm:
- Next.js (UI 3D) phục vụ qua **server Node tuỳ biến** (`server/index.js` — WebSocket proxy tới gateway).
- **Adapter Node** (`server/claude-code-runtime-adapter.js`) — spawn `claude`.

| | Electron | Tauri |
|---|---|---|
| Runtime Node sẵn | ✅ (bọc Node + Chromium) | ❌ (Rust + webview hệ thống) — phải ship Node làm "sidecar" và tự spawn |
| Hợp app Node-server | ✅ Rất hợp | ⚠️ Làm được nhưng phức tạp hơn nhiều |
| Kích thước cài đặt | ~150–250MB | ~10–30MB (nhưng phải cộng Node sidecar ~50MB) |
| Spawn `claude` CLI | ✅ `child_process` | ✅ `tauri-plugin-shell` (cần khai báo allowlist) |
| Công sức cho repo NÀY | Thấp–Trung | Trung–Cao |

→ **Electron** vì app đã là Node-server. Tauri chỉ đáng cân nhắc nếu sau này viết lại backend bằng Rust/Go (không khuyến nghị bây giờ).

## 2. Kiến trúc gói Electron (đề xuất)

```
Electron main process
 ├─ spawn server Studio Next.js (next standalone) → cổng 3000 (nội bộ)
 ├─ spawn adapter (claude-code-runtime-adapter.js) → cổng 7770 (nội bộ)
 └─ BrowserWindow load http://127.0.0.1:3000/office
```

Người dùng bấm icon → 1 cửa sổ hiện văn phòng, không cần terminal.

## 3. Các bước (lộ trình Electron)

1. **Build Next.js standalone**: bật `output: "standalone"` trong `next.config.ts` → `next build` ra bản gọn kèm `node_modules` tối thiểu.
2. **Electron main** (`electron/main.js`): khi app `ready`, spawn server Studio + adapter (dùng Node bundled của Electron), chờ cổng 3000 sẵn sàng rồi `win.loadURL`.
3. **electron-builder**: cấu hình target `nsis` (Windows → .exe installer) và `dmg` (macOS). Đóng gói cả thư mục `.next/standalone`, `server/`, `public/`, `claude-agents.json`.
4. **Quản lý cổng**: nếu 3000/7770 bận thì chọn cổng trống động (tránh xung đột khi mở 2 lần).
5. **Tắt sạch**: khi đóng cửa sổ, kill 2 tiến trình con.

Ước lượng công sức: **2–4 ngày** cho bản chạy được; thêm vài ngày cho ký số + auto-update.

## 4. Tương thích Claude Code — chi tiết & cạm bẫy

Adapter gọi `claude -p`. Trong app đóng gói:

- ✅ **Hoạt động** nếu người dùng đã cài Claude Code + đăng nhập (hoặc `ANTHROPIC_API_KEY`). Giống hệt cách chạy `npm run claude-adapter` hiện tại.
- ⚠️ **macOS PATH:** app mở từ Finder không có PATH của shell → `claude` (ở `~/.local/bin` hoặc `/usr/local/bin`) **không tìm thấy**. Cách xử:
  - Dò các đường dẫn cố định: `~/.local/bin/claude`, `/usr/local/bin/claude`, `/opt/homebrew/bin/claude`; hoặc
  - Đọc PATH thật của user (vd thư viện `shell-env`/`fix-path`); hoặc
  - Cho người dùng tự trỏ `CLAUDE_BIN` trong phần Cài đặt.
  - **Adapter đã hỗ trợ `CLAUDE_BIN`** sẵn → chỉ cần thêm UI nhập đường dẫn.
- ⚠️ **Windows:** thường ổn (adapter đã dùng shell để chạy cả `claude.cmd` lẫn `claude.exe`). App đóng gói nên đảm bảo spawn với môi trường có PATH hệ thống.
- ℹ️ **Không bundle Claude Code:** không thể (license + auth riêng). App nên **kiểm tra lúc khởi động** (đã có `claude --version` probe) và nếu thiếu thì hiện hướng dẫn cài + ô nhập `CLAUDE_BIN` / `ANTHROPIC_API_KEY`.
- ℹ️ **Giới hạn tuần:** nếu dùng gói Pro/Max, vẫn áp dụng hạn mức tuần (chat trả 502 khi cạn). Khuyên người dùng đặt `ANTHROPIC_API_KEY` nếu cần dùng nhiều.

→ **Kết luận tương thích:** Chạy tốt với Claude Code, **với điều kiện** giải quyết PATH (nhất là macOS) và máy người dùng đã cài + đăng nhập Claude Code.

## 5. Phát hành (ký số — đừng bỏ qua)

| Nền tảng | Cần gì | Nếu bỏ qua |
|---|---|---|
| Windows .exe | Chứng chỉ Code Signing (EV/OV, ~$100–400/năm) | SmartScreen cảnh báo "Unknown publisher" |
| macOS .dmg | Apple Developer ($99/năm) + **notarization** | Gatekeeper chặn "app không xác định" |

Auto-update: `electron-updater` (lưu bản phát hành trên GitHub Releases) — gắn được với CI sẵn có.

## 6. Lựa chọn nhẹ hơn (nếu chưa muốn làm app)

- **Script cài 1 lệnh**: gói `npm`/`npx` + một script bật cả 2 server → mở trình duyệt. Không có icon nhưng nhanh ra mắt.
- **Docker**: repo đã có `Dockerfile`. Hợp để tự host trên server, không hợp người dùng cuối trên máy cá nhân.

## 7. Khuyến nghị lộ trình

1. Trước mắt: giữ cách chạy `npm` + hướng dẫn (đã có). Ổn cho người kỹ thuật.
2. Khi cần "phần mềm cho người không rành tech": làm **Electron** (Windows .exe trước — dễ hơn macOS vì không cần notarization), kèm:
   - Màn hình khởi động kiểm tra `claude` + nhập `CLAUDE_BIN`/`ANTHROPIC_API_KEY`.
   - Tự chọn cổng trống.
3. Sau đó thêm macOS .dmg (giải quyết PATH + notarization) và auto-update.

## Câu hỏi cần làm rõ (khi bắt tay làm Electron)

1. Đối tượng dùng: người kỹ thuật (script là đủ) hay người dùng cuối (cần app + ký số)?
2. Có sẵn tài khoản Apple Developer / chứng chỉ Windows code-signing chưa?
3. Có muốn auto-update qua GitHub Releases không?
