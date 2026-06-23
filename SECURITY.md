# Chính sách bảo mật

## Báo cáo lỗ hổng bảo mật

Vui lòng không mở public GitHub issue cho các lỗ hổng bảo mật.

Đường dẫn ưu tiên:

- Nếu repository host có private vulnerability reporting hoặc GitHub Security Advisories cho repo này, hãy dùng đường dẫn đó trước.

Đường dẫn dự phòng:

- Nếu không có kênh báo cáo riêng tư nào khả dụng, mở một public issue tối thiểu yêu cầu kênh liên lạc riêng tư và không bao gồm chi tiết exploit, token hoặc proof-of-concept payload trong issue đó.

Khi báo cáo lỗ hổng, bao gồm:

- Mô tả rõ ràng về vấn đề.
- Tác động và các khu vực bị ảnh hưởng.
- Các bước tái hiện hoặc proof of concept.
- Bất kỳ đề xuất giảm thiểu nào nếu bạn có.

Chúng tôi hướng đến việc xác nhận báo cáo kịp thời, điều tra chúng và phối hợp lịch trình fix và disclosure với người báo cáo.

## Giới hạn bảo mật hiện tại

- Cài đặt gateway Studio được lưu trên disk dưới dạng plaintext trong thư mục trạng thái OpenClaw cục bộ.
- UI hiện tại tải URL/token upstream gateway đã cấu hình vào bộ nhớ trình duyệt lúc runtime, mặc dù các giá trị đó không được lưu trong browser persistent storage.
- Hiện không có built-in cookie issuance/login flow cho `STUDIO_ACCESS_TOKEN`; các deployment bật access gate phải provision cookie `studio_access` bên ngoài ứng dụng.

## Phạm vi

Vui lòng báo cáo các vấn đề liên quan đến:

- Bỏ qua xác thực hoặc kiểm soát truy cập.
- Xử lý secret hoặc lộ token.
- Các đường dẫn thực thi mã từ xa hoặc leo thang đặc quyền.
- Hành vi filesystem, proxy hoặc mạng không an toàn.
- Lỗ hổng dependency ảnh hưởng đáng kể đến dự án này.

## Ghi chú triển khai

- Trong production, đặt `UPSTREAM_ALLOWLIST` cho Studio gateway proxy.
- Trong production, đặt `CUSTOM_RUNTIME_ALLOWLIST` nếu bạn dùng `/api/runtime/custom`. Nếu không đặt, nó fallback về `UPSTREAM_ALLOWLIST`.
- Allowlist trống chỉ dành cho local development.
- Nếu bạn bật `STUDIO_ACCESS_TOKEN`, bạn cũng phải provision cookie `studio_access` qua deployment/auth layer của bạn.

## Lưu ý: đổi tên header văn phòng-tới-văn phòng

Header token dùng để xác thực kết nối presence/layout giữa hai instance VN AI Agent Office đã được đổi tên từ `X-Claw3D-Office-Token` thành `X-VN-Office-Token`. Khi vận hành cài đặt multi-office, cả hai peer phải chạy build đã đổi tên. Instance vẫn gửi header cũ `X-Claw3D-Office-Token` sẽ bị từ chối.
