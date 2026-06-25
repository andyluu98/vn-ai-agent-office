# Hướng dẫn học viên: cài Office để xem agent vn-opc hoạt động

Dành cho học viên **đã cài xong Claude Code + vn-one-person-company (vn-opc)**,
đã chạy được phòng ban + họp/debate. Office 3D chỉ là **tấm gương để NHÌN** —
vn-opc vẫn là bộ não, Office không tự chạy gì.

## Cần có sẵn (bạn đã có)
- Node.js (>= 18).
- Claude Code đã đăng nhập (hoặc có `ANTHROPIC_API_KEY`).
- vn-opc đã cài, có **vault** (đã `setx VN_OS_DEFAULT_VAULT "..."`).

## Các bước cài Office

### 1. Lấy Office về
```bash
git clone https://github.com/andyluu98/vn-ai-agent-office
cd vn-ai-agent-office
npm install
```

### 2. Tạo file .env (chỉ sửa 1 dòng)
```bash
# Windows
copy .env.example .env
```
Mở `.env`, tìm dòng `CLAUDE_ADAPTER_DEPARTMENTS_DIR`, **bỏ dấu #** và sửa đường
dẫn trỏ tới thư mục `departments` của vn-opc **trên máy bạn**:
```
CLAUDE_ADAPTER_DEPARTMENTS_DIR=C:/duong-dan-toi/vn-one-person-company/departments
```
> `VN_OS_DEFAULT_VAULT` thường vn-opc đã đặt sẵn (setx) → không cần khai lại.
> Nếu chưa có thì cũng bỏ # và trỏ tới vault của bạn.

### 3. Kiểm tra điều kiện (1 lệnh)
```bash
npm run doctor
```
Xem mục **OPC Mirror** — nó báo rõ thiếu gì (Claude Code? departments dir? vault?
adapter?). Sửa theo gợi ý cho tới khi xanh.

### 4. Chạy 3 tiến trình (mở 3 cửa sổ terminal)
```bash
npm run dev             # văn phòng 3D  → mở http://localhost:3000/office
npm run claude-adapter  # nạp agent phòng ban vn-opc vào office
npm run opc-mirror      # gương: phản chiếu hoạt động từ vault
```

### 5. Kết nối Office với adapter
Mở `http://localhost:3000/office` → bấm **Kết nối** → chọn backend **Custom**,
URL `http://127.0.0.1:7770` → thấy các agent đứng theo **phòng ban**.

### 6. Xem agent họp (thật)
Trong **Claude Code**, chạy 1 cuộc họp vn-opc như thường, ví dụ:
- `vn_run` tạo task → `vn_meeting` cho task đó.

Khi cuộc họp chạy, Office **tự động**:
- Trưởng phòng của các phòng ban liên quan **đi vào phòng họp**.
- Các thành viên còn lại **đứng tại bàn + nổi bong bóng góp ý**.
- Họp xong → hiện card **"📋 Kết luận"** trên bảng Kanban (mở report trong vault).

## Sửa lỗi nhanh
| Triệu chứng | Cách xử lý |
|---|---|
| Office chỉ có 8 agent, không thấy phòng ban | `CLAUDE_ADAPTER_DEPARTMENTS_DIR` sai/chưa đặt. Sửa `.env`, **khởi động lại** `npm run claude-adapter`. |
| "Gateway is not connected" | Adapter chưa chạy. Chạy `npm run claude-adapter` rồi bấm Kết nối lại. |
| Họp opc xong mà office không hiện gì | `npm run opc-mirror` chưa chạy, hoặc `VN_OS_DEFAULT_VAULT` sai. Chạy `npm run doctor` xem mục OPC Mirror. |
| Port 7770 bị chiếm | Có adapter cũ đang chạy. Tắt tiến trình node cũ rồi chạy lại. |

## Ghi nhớ
- vn-opc = não (chạy thật, giữ vault). Office = gương (chỉ đọc, chỉ hiển thị).
- Office **không** sửa gì trong vault, **không** tự gọi họp.
