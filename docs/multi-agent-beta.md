# Multi-Agent Beta

Tài liệu này giải thích multi-agent beta hiện tại trong VN AI Agent Office: nó làm gì, hai chế độ kết nối hoạt động như thế nào và cách kết nối văn phòng thứ hai.

## Beta này làm gì

VN AI Agent Office có thể render văn phòng thứ hai bên trong cùng cảnh 3D để bạn có thể hiển thị agent từ máy khác.

Hiện tại beta hỗ trợ:

- hiển thị văn phòng thứ hai trong cùng thế giới;
- hiển thị remote agent dưới dạng sự hiện diện read-only;
- tùy chọn gửi tin nhắn văn bản thuần túy tới remote agent;
- giữ phía remote cô lập khỏi file cục bộ và điều khiển văn phòng của bạn.

Đây là tính năng beta. Nó được thiết kế cho khả năng hiển thị và nhắn tin cross-office nhẹ, không phải cộng tác shared-state đầy đủ.

## Mô hình tư duy

Luôn có hai vai trò:

- **Văn phòng cục bộ**: instance VN AI Agent Office bạn đang sử dụng;
- **Văn phòng từ xa**: instance VN AI Agent Office khác hoặc OpenClaw gateway khác bạn muốn hiển thị.

Văn phòng từ xa có thể được kết nối theo một trong hai cách:

1. **Remote VN AI Agent Office presence endpoint**.
2. **Remote OpenClaw gateway**.

## Chế độ kết nối

### 1. Remote VN AI Agent Office Presence Endpoint

Dùng khi máy kia cũng đang chạy VN AI Agent Office.

Cách hoạt động:

- Studio VN AI Agent Office cục bộ của bạn poll endpoint `presence` của VN AI Agent Office từ xa;
- nó cũng cố tải snapshot `layout` của văn phòng từ xa;
- cảnh 3D cục bộ render văn phòng từ xa như một bản sao read-only bên trong cùng thế giới.

URL điển hình:

```text
https://other-office.example.com/api/office/presence
```

Chế độ này phù hợp nhất khi bạn muốn phía remote cảm giác như một văn phòng VN AI Agent Office đầy đủ khác.

### 2. Remote OpenClaw Gateway

Dùng khi máy kia chỉ chạy OpenClaw và không chạy VN AI Agent Office.

Cách hoạt động:

- trình duyệt kết nối trực tiếp tới remote gateway;
- VN AI Agent Office dẫn xuất snapshot sự hiện diện read-only từ dữ liệu gateway như `agents.list`, `status` và `sessions.preview`;
- vì không có remote VN AI Agent Office layout endpoint, văn phòng thứ hai sử dụng hiển thị văn phòng fallback.

URL điển hình:

```text
ws://remote-host:18789
```

hoặc:

```text
wss://remote-host.example.com
```

Nếu bạn dán URL `http://` hoặc `https://` vào chế độ gateway, VN AI Agent Office chuẩn hóa nó thành `ws://` hoặc `wss://` trước khi kết nối.

Chế độ này phù hợp nhất khi bạn muốn khả năng hiển thị remote agent mà không cần triển khai VN AI Agent Office thứ hai.

## Những gì bạn có thể thấy

Khi beta được bật, bạn có thể:

- thấy văn phòng thứ hai trong cùng môi trường;
- thấy remote agent xuất hiện trong văn phòng đó;
- thấy remote agent di chuyển và thay đổi trạng thái hoạt động cơ bản;
- nhấp vào remote agent và mở panel nhắn tin chỉ văn bản.

## Những gì bạn không thể thấy

Văn phòng từ xa bị giới hạn có chủ đích.

Bạn không thể:

- kiểm tra remote machine filesystem;
- duyệt lịch sử chat agent từ xa đầy đủ;
- điều khiển đồ nội thất văn phòng từ xa hoặc trạng thái builder;
- tiếp quản instance từ xa như thể nó là cục bộ.

Mục tiêu là hiển thị cross-office, không phải truy cập workstation từ xa.

## Nhắn tin từ xa

Nhắn tin từ xa hiện là relay nhẹ với hai chế độ gửi.

Nó làm gì:

- cho phép bạn gửi ghi chú văn bản thuần túy tới remote agent;
- cho phép bạn chọn delivery `direct` hoặc `interval` trong remote chat panel;
- có sẵn từ remote agent chat panel;
- được thiết kế để tránh expose file từ xa hoặc tool output trong VN AI Agent Office UI.

`direct` dành cho các ping một lần.

`interval` dành cho thread điều phối liên tục nơi bạn mong đợi các cập nhật định kỳ ngắn hoặc checkpoint.

Giới hạn hiện tại:

- remote reply chưa được mirror trở lại vào panel;
- panel hiện hiển thị tin nhắn đã gửi của bạn cộng với delivery/system feedback;
- đây không phải là shared transcript viewer.

## Lớp Runtime Message và Handoff

Phía sau, VN AI Agent Office hiện dùng hợp đồng runtime chung cho:

- `agents.message`
- `agents.handoff`

OpenClaw, Hermes, Demo và các direct runtime profile custom/local/claw3d đều có thể target cùng message/handoff seam. Các provider-native adapter như Anthropic hoặc Claude Code vẫn là một slice follow-up.

## Lưu ý quan trọng: token header văn phòng-tới-văn phòng

Header token presence/layout giữa hai instance VN AI Agent Office đã được đổi tên từ `X-Claw3D-Office-Token` thành `X-VN-Office-Token`. Khi kết nối hai văn phòng VN AI Agent Office với nhau, cả hai phải chạy build đã đổi tên. Nếu một bên vẫn gửi header cũ `X-Claw3D-Office-Token`, kết nối presence sẽ bị từ chối.

## Cách kết nối

### Điều kiện tiên quyết

Trước khi bật văn phòng thứ hai, đảm bảo:

- VN AI Agent Office cục bộ của bạn đã hoạt động với OpenClaw gateway cục bộ;
- bạn biết chế độ từ xa nào bạn muốn dùng;
- máy từ xa có thể truy cập từ máy hoặc trình duyệt của bạn;
- bất kỳ token, origin allowlist hoặc quyền truy cập private-network cần thiết đã được cấu hình.

### Các bước cài đặt

1. Khởi động instance VN AI Agent Office cục bộ của bạn.
2. Mở office UI.
3. Mở office settings panel.
4. Bật `Show second office`.
5. Chọn `Source type` đúng.
6. Điền các trường kết nối phù hợp.

### Cài đặt cho `Remote VN AI Agent Office presence endpoint`

Dùng:

- `Source type`: `Remote VN AI Agent Office presence endpoint`.
- `Presence URL`: URL `/api/office/presence` từ xa.
- `Optional token`: chỉ khi endpoint VN AI Agent Office từ xa đó được bảo vệ.

Ví dụ:

```text
https://other-office.example.com/api/office/presence
```

Hành vi mong đợi:

- văn phòng thứ hai xuất hiện bên trong thế giới;
- remote agent hiển thị khi văn phòng từ xa có sự hiện diện active;
- nếu remote layout snapshot không khả dụng, VN AI Agent Office fallback về rendering văn phòng default/fallback cho phía từ xa.

### Cài đặt cho `Remote OpenClaw gateway`

Dùng:

- `Source type`: `Remote OpenClaw gateway`.
- `Gateway URL`: remote gateway WebSocket URL.
- `Shared gateway token`: tùy chọn khi gateway đã cho phép Control UI origin và connection model của bạn.

Ví dụ:

```text
ws://remote-host:18789
```

```text
wss://remote-host.example.com
```

Hành vi mong đợi:

- văn phòng thứ hai xuất hiện bên trong thế giới;
- remote agent được dẫn xuất từ dữ liệu gateway presence;
- office shell là hiển thị fallback, không phải bản sao remote layout thực từ instance VN AI Agent Office khác.

## Các pattern mạng được khuyến nghị

### Cùng private network

Dùng private IP hoặc local hostname có thể truy cập cho remote VN AI Agent Office endpoint hoặc OpenClaw gateway.

### Tailscale

Tailscale phù hợp tốt với beta này vì nó cho phép cả hai phía kết nối qua private network mà không expose service công khai.

Các pattern phổ biến:

- remote VN AI Agent Office endpoint qua `https://<machine>.ts.net/api/office/presence`;
- remote OpenClaw gateway qua `wss://<machine>.ts.net` nếu bạn đang proxy gateway qua HTTPS/WSS;
- direct gateway qua `ws://<machine>:18789` khi cả hai thiết bị có thể truy cập service riêng tư.

## Hành vi tắt

Nếu bạn tắt `Show second office`:

- văn phòng thêm nên biến mất khỏi cảnh 3D;
- path/outdoor connection nên biến mất;
- presence và layout hook văn phòng từ xa nên ngừng điều khiển cảnh.

Điều này cho phép bạn trở về chế độ single-office.

## Khắc phục sự cố

### Không có remote agent xuất hiện

Kiểm tra:

- URL từ xa là đúng;
- máy từ xa thực sự có thể truy cập;
- service từ xa đang chạy;
- `Source type` được chọn khớp với service bạn đang trỏ vào.

### Presence endpoint hoạt động nhưng remote layout không

Điều đó thường có nghĩa là máy kia có VN AI Agent Office presence khả dụng nhưng chưa có layout snapshot. Beta vẫn nên render một remote office fallback.

### Gateway mode kết nối nhưng nhắn tin thất bại

Trong chế độ gateway, trình duyệt kết nối trực tiếp tới remote gateway. Điều đó có nghĩa là remote gateway vẫn có thể từ chối kết nối dựa trên origin policy hoặc các quy tắc bảo mật phía gateway khác.

Nếu điều đó xảy ra, kiểm tra:

- remote gateway URL;
- liệu remote gateway có cho phép Control UI origin của bạn không;
- liệu remote gateway có mong đợi token hoặc device-auth flow bạn chưa cấu hình không.

### Bạn có thể truy cập trang HTTPS nhưng chế độ gateway vẫn thất bại

Mở trang web trong trình duyệt không tự động có nghĩa là OpenClaw gateway WebSocket có thể truy cập.

Ví dụ:

- `https://host` có thể truy cập trong khi `ws://host:18789` thì không;
- reverse proxy website có thể tồn tại mặc dù cổng gateway thô bị đóng;
- phía từ xa có thể cần một WSS proxy path chuyên dụng cho gateway.

## Giới hạn Beta hiện tại

- Văn phòng thứ hai là read-only.
- Remote reply chưa được mirror vào local remote-chat panel.
- Chế độ gateway dẫn xuất presence từ gateway snapshot thay vì remote VN AI Agent Office layout thực sự.
- Chế độ gateway dựa trên trình duyệt phụ thuộc vào remote gateway cho phép kết nối từ Control UI origin của bạn.
- Tính năng này vẫn đang phát triển và nên được xử lý như beta, không phải cộng tác multi-tenant production-grade cuối cùng.

## Tóm tắt

Dùng `Remote VN AI Agent Office presence endpoint` khi phía kia chạy VN AI Agent Office và bạn muốn hiển thị văn phòng đầy đủ nhất.

Dùng `Remote OpenClaw gateway` khi phía kia chỉ chạy OpenClaw và bạn chủ yếu muốn remote agent presence cộng với nhắn tin văn bản nhẹ.
