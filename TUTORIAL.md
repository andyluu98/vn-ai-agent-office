# Hướng dẫn cài đặt VN AI Agent Office + OpenClaw + Tailscale

Đây là hướng dẫn từng bước cho cài đặt phổ biến nhất giống môi trường production:

- **Máy A** chạy **OpenClaw Gateway**.
- **Máy B** chạy **VN AI Agent Office**.
- **Tailscale** kết nối hai máy một cách bảo mật.

Nếu làm theo chính xác, bạn sẽ tránh được lỗi nhầm lẫn phổ biến nhất: **VN AI Agent Office không cài đặt hoặc chạy OpenClaw cho bạn.**

---

## 0) Kiến trúc và trách nhiệm

- **OpenClaw** là runtime và Gateway.
- **VN AI Agent Office** là UI và Studio proxy.
- VN AI Agent Office kết nối với OpenClaw Gateway đã đang chạy.
- Trong hướng dẫn này, Gateway nằm trên máy khác với VN AI Agent Office.

---

## 1) Điều kiện tiên quyết

### Máy A (Gateway host)

- macOS, Linux hoặc WSL2.
- Kết nối internet.
- Khả năng cài OpenClaw và Tailscale.

### Máy B (VN AI Agent Office host)

- Node.js `20+` khuyến nghị cho repo này.
- npm `10+` khuyến nghị.
- Kết nối internet.
- Khả năng cài Tailscale.

### Tài khoản và quyền hạn

- Tài khoản Tailscale cho tailnet của bạn.
- Nếu tailnet của bạn dùng device approval, bạn cần quyền Owner/Admin/IT admin trong Tailscale admin.

---

## 2) Cài đặt và khởi động OpenClaw trên Máy A

Tài liệu cài đặt chính thức của OpenClaw ở đây: [Install](https://docs.openclaw.ai/install/index.md) và [Getting Started](https://docs.openclaw.ai/start/getting-started.md).

### 2.1 Cài đặt OpenClaw

Trên **Máy A**:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

### 2.2 Chạy onboarding và cài daemon

```bash
openclaw onboard --install-daemon
```

### 2.3 Kiểm tra trạng thái Gateway

```bash
openclaw gateway status
openclaw status
```

Bạn muốn kết quả healthy như runtime đang chạy và RPC probe ok.

### 2.4 Lấy Gateway token của bạn

Bạn sẽ cần token này trong VN AI Agent Office:

```bash
openclaw config get gateway.auth.token
```

Lưu trữ nó an toàn.

---

## 3) Cài đặt và ủy quyền Tailscale trên cả hai máy

Tài liệu Tailscale: [Serve overview](https://tailscale.com/kb/1312/serve), [Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve) và [Device approval](https://tailscale.com/kb/1099/device-approval).

### 3.1 Cài đặt Tailscale

Cài Tailscale trên **Máy A** và **Máy B** bằng installer chính thức: [Tailscale downloads](https://tailscale.com/download).

### 3.2 Tham gia cả hai máy vào cùng tailnet

Trên mỗi máy:

```bash
tailscale up
tailscale status
```

Xác nhận cả hai máy xuất hiện trong cùng một tailnet.

### 3.3 Nếu tailnet của bạn yêu cầu approval, phê duyệt thiết bị

Trong Tailscale admin:

1. Mở [Machines](https://login.tailscale.com/admin/machines).
2. Tìm các thiết bị được đánh dấu **Needs approval**.
3. Phê duyệt cả Máy A và Máy B.

Nếu không làm bước này, các máy không thể giao tiếp qua tailnet traffic.

---

## 4) Expose OpenClaw Gateway qua Tailscale trên Máy A

Bạn có hai cách hợp lệ. Chọn một.

### Tùy chọn A (đơn giản và rõ ràng): Lệnh Tailscale Serve

Trên **Máy A**, giữ Gateway bound cục bộ (`127.0.0.1:18789`) và publish qua Serve:

```bash
tailscale serve --yes --bg --https=443 http://127.0.0.1:18789
tailscale serve status
```

Lưu ý:

- Tailscale CLI mới hơn dùng `--https=443`.
- Nếu bạn đang dùng tài liệu/lệnh cũ hơn, bạn có thể thấy cú pháp như `--https 443`. Dùng `tailscale serve --help` trên phiên bản đã cài.

### Tùy chọn B (chế độ Tailscale do OpenClaw quản lý)

OpenClaw có thể tự quản lý chế độ Tailscale:

```bash
openclaw gateway --tailscale serve
```

Tài liệu Tailscale của OpenClaw: [Gateway Tailscale](https://docs.openclaw.ai/gateway/tailscale.md).

### 4.1 Xác nhận URL tailnet công khai

Bạn cần host `https://<gateway-host>.<tailnet>.ts.net`.

Đây là host mà VN AI Agent Office sẽ dùng là `wss://<gateway-host>.<tailnet>.ts.net`.

---

## 5) Cài đặt và chạy VN AI Agent Office trên Máy B

Trên **Máy B**:

```bash
git clone https://github.com/iamlukethedev/Claw3D.git vn-ai-agent-office
cd vn-ai-agent-office
npm install
cp .env.example .env
npm run dev
```

Sau đó mở:

- `http://localhost:3000`

---

## 6) Kết nối VN AI Agent Office với OpenClaw

Trong UI kết nối VN AI Agent Office:

1. Đặt **Gateway URL** thành:
   - `wss://<gateway-host>.<tailnet>.ts.net`
2. Dán token từ Máy A (`openclaw config get gateway.auth.token`).
3. Nhấn **Connect**.

Quan trọng:

- Dùng `wss://` cho các endpoint HTTPS Tailscale.
- Chỉ dùng `ws://localhost:18789` khi Gateway là cục bộ trên cùng máy với VN AI Agent Office hoặc khi dùng SSH tunnel.

---

## 7) Bước phê duyệt ghép đôi thiết bị bắt buộc

Đây là bước người ta thường bỏ qua.

Sau khi VN AI Agent Office đang chạy và cố gắng kết nối lần đầu, phê duyệt yêu cầu ghép đôi thiết bị đang chờ trên **Máy A**:

```bash
openclaw devices list
openclaw devices approve --latest
```

Tài liệu devices của OpenClaw: [openclaw devices](https://docs.openclaw.ai/cli/devices.md).

Nếu có nhiều yêu cầu đang chờ, phê duyệt theo id thay thế:

```bash
openclaw devices approve <requestId>
```

---

## 8) Danh sách kiểm tra xác nhận

Chạy danh sách kiểm tra này theo thứ tự:

1. `openclaw gateway status` trên Máy A hiển thị runtime healthy.
2. `tailscale status` trên cả hai máy hiển thị các thiết bị kết nối trong cùng tailnet.
3. `tailscale serve status` trên Máy A hiển thị cấu hình Serve đang hoạt động cho cổng `443` tới `127.0.0.1:18789`.
4. UI kết nối VN AI Agent Office dùng `wss://...ts.net` cộng với token hợp lệ.
5. `openclaw devices approve --latest` đã được chạy sau lần thử kết nối đầu tiên.
6. UI VN AI Agent Office hiển thị gateway đã kết nối và tải agents.

---

## 9) Khắc phục sự cố

### `EPROTO` hoặc `wrong version number`

- Thường có nghĩa là protocol không khớp.
- Khắc phục: nếu endpoint của bạn là HTTPS/Tailscale Serve, dùng `wss://...`.
- Không dùng `wss://` với endpoint `ws://` thông thường.

### Lỗi `401` hoặc auth từ VN AI Agent Office

- Sao chép lại token từ Máy A:
  - `openclaw config get gateway.auth.token`.
- Xác nhận chế độ auth Gateway và token đang dùng.

### VN AI Agent Office vẫn không thể kết nối sau khi token đúng

- Phê duyệt thiết bị đang chờ:
  - `openclaw devices approve --latest`.
- Kiểm tra các yêu cầu đang chờ:
  - `openclaw devices list`.

### URL Tailscale không hoạt động

- Xác nhận cả hai thiết bị được phê duyệt trong Tailscale admin nếu device approval được bật.
- Chạy lại:
  - `tailscale status`.
  - `tailscale serve status`.
- Tạo lại cấu hình serve nếu cần:
  - `tailscale serve reset`.
  - `tailscale serve --yes --bg --https=443 http://127.0.0.1:18789`.

### Gateway bản thân không healthy

- Chạy:
  - `openclaw doctor`.
  - `openclaw gateway restart`.
  - `openclaw gateway status`.

---

## 10) Ghi chú bảo mật

- Giữ Gateway bound với loopback trừ khi bạn có lý do cố ý không làm vậy.
- Không commit token vào git hoặc file `.env` dành cho chia sẻ.
- Ưu tiên Tailscale Serve hơn việc expose cổng Gateway thô công khai.
- Coi việc phê duyệt device pairing OpenClaw là cổng bảo mật, không phải phiền toái một lần.

---

## Tài liệu tham khảo

- OpenClaw install: [docs.openclaw.ai/install/index.md](https://docs.openclaw.ai/install/index.md).
- OpenClaw getting started: [docs.openclaw.ai/start/getting-started.md](https://docs.openclaw.ai/start/getting-started.md).
- OpenClaw gateway runbook: [docs.openclaw.ai/gateway/index.md](https://docs.openclaw.ai/gateway/index.md).
- OpenClaw devices CLI: [docs.openclaw.ai/cli/devices.md](https://docs.openclaw.ai/cli/devices.md).
- OpenClaw tailscale gateway mode: [docs.openclaw.ai/gateway/tailscale.md](https://docs.openclaw.ai/gateway/tailscale.md).
- Tailscale Serve: [tailscale.com/kb/1312/serve](https://tailscale.com/kb/1312/serve).
- Tailscale serve CLI: [tailscale.com/docs/reference/tailscale-cli/serve](https://tailscale.com/docs/reference/tailscale-cli/serve).
- Tailscale device approval: [tailscale.com/kb/1099/device-approval](https://tailscale.com/kb/1099/device-approval).
