# Tầm nhìn VN AI Agent Office

VN AI Agent Office là môi trường 3D mã nguồn mở để hiển thị và tương tác với các AI agent được hỗ trợ bởi OpenClaw.

Mục tiêu dài hạn của VN AI Agent Office là xây dựng một thế giới 3D sống động nơi các AI agent và con người cộng tác: một thành phố kỹ thuật số nơi các agent vận hành, giao tiếp và thực thi nhiệm vụ trong không gian trực quan chung.

OpenClaw đóng vai trò là engine thông minh và điều phối, trong khi VN AI Agent Office cung cấp lớp trực quan và môi trường tương tác làm cho hoạt động của agent trở nên dễ hiểu, có thể kiểm tra và có tính cộng tác.

Tài liệu này giải thích định hướng của dự án và các guardrail hướng dẫn quá trình phát triển.

Tổng quan dự án và tài liệu developer có thể tìm thấy trong:

- [`README.md`](README.md)
- [`ROADMAP.md`](ROADMAP.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Tại sao VN AI Agent Office tồn tại

Các hệ thống AI ngày càng trở nên có khả năng hơn, nhưng hành vi của chúng thường vô hình hoặc khó hiểu.

VN AI Agent Office hướng đến giải quyết vấn đề này bằng cách cung cấp giao diện trực quan cho các hệ thống AI, cho phép mọi người:

- quan sát AI agent hoạt động theo thời gian thực
- hiểu hành vi hệ thống một cách trực quan
- cộng tác với AI trong môi trường chung
- debug và kiểm tra các tương tác agent phức tạp

Tầm nhìn cuối cùng là một thành phố AI agent 3D, nơi:

- các agent đại diện cho dịch vụ, nhiệm vụ và workflow
- con người có thể khám phá, giám sát và tương tác với chúng
- hệ thống trở nên dễ hiểu thông qua tương tác không gian

## Mối quan hệ với OpenClaw

VN AI Agent Office được thiết kế để hoạt động với OpenClaw, không thay thế nó.

OpenClaw cung cấp:

- điều phối agent
- công cụ và tích hợp
- kênh giao tiếp
- thực thi nhiệm vụ
- tích hợp model provider

VN AI Agent Office cung cấp:

- hiển thị
- tương tác
- biểu diễn không gian của agent và hệ thống
- môi trường cộng tác cho con người và AI

Nói đơn giản:

```text
OpenClaw            -> thông minh và thực thi nhiệm vụ
VN AI Agent Office  -> lớp hiển thị và tương tác
```

Duy trì tương thích với OpenClaw là mục tiêu thiết kế quan trọng.

Các tính năng yêu cầu phá vỡ tích hợp OpenClaw nói chung sẽ không được chấp nhận trừ khi có lý do kiến trúc mạnh mẽ.

## Ưu tiên hiện tại

VN AI Agent Office vẫn đang trong giai đoạn phát triển sớm.

Các ưu tiên hiện tại bao gồm:

### Tính ổn định và độ tin cậy

- sửa lỗi
- hành vi rendering có thể dự đoán
- cải thiện trải nghiệm developer

### Kiến trúc cốt lõi

- xác định cách agent ánh xạ tới các thực thể trực quan
- xây dựng mô hình thế giới có thể mở rộng
- thiết lập đường tích hợp sạch với OpenClaw

### Ergonomics cho developer

- API rõ ràng để mở rộng môi trường
- cài đặt cục bộ dễ dàng
- con đường đóng góp đơn giản

### Nguyên thủy hiển thị

- biểu diễn agent
- biểu diễn workflow
- biểu diễn hoạt động hệ thống dưới dạng không gian

## Quy tắc đóng góp

Để dự án có thể bảo trì được:

- Một PR = một chủ đề. Tránh gộp các thay đổi không liên quan.
- PR quá lớn có thể bị từ chối hoặc tách thành các phần nhỏ hơn.
- Các thay đổi kiến trúc nên được thảo luận trong issues trước khi triển khai.
- Contributor nên tôn trọng định hướng và phạm vi của dự án.

VN AI Agent Office vẫn đang phát triển nhanh, vì vậy sự lặp lại là điều được mong đợi.

## Định hướng kiến trúc

VN AI Agent Office được thiết kế như lớp trực quan trên đỉnh các hệ thống agent.

Hệ thống nên duy trì:

- tính mô đun
- khả năng mở rộng
- dễ thử nghiệm

Stack hiện tại tập trung vào:

- Three.js
- WebGL
- browser-based rendering
- tích hợp với các hệ thống runtime OpenClaw

Mục tiêu là giữ cho môi trường có thể tiếp cận với developer và contributor.

## Những gì chúng tôi sẽ không merge (hiện tại)

Để duy trì tập trung, các loại đóng góp sau đây thường được tránh:

- tính năng phá vỡ tương thích với OpenClaw
- viết lại kiến trúc lớn mà không có thảo luận trước
- thay thế rendering stack mà không có lý do kỹ thuật mạnh mẽ
- các lớp framework nặng làm giảm khả năng hack
- PR cực lớn mà không có sự phối hợp trước
- thử nghiệm sản phẩm không liên quan không thúc đẩy tầm nhìn VN AI Agent Office

Danh sách này là guardrail định hướng, không phải hạn chế vĩnh viễn.

Các lập luận kỹ thuật mạnh mẽ hoặc nhu cầu người dùng có thể thay đổi các quyết định này.

## Định hướng dài hạn

Tầm nhìn dài hạn cho VN AI Agent Office đầy tham vọng:

**Một thành phố AI agent 3D.**

Trong môi trường này:

- AI agent hoạt động như các thực thể có thể nhìn thấy
- hệ thống trở nên có thể hiểu được không gian
- con người có thể tương tác với hệ thống agent theo thời gian thực
- sự cộng tác giữa con người và AI trở nên tự nhiên

Thay vì tương tác với các hệ thống vô hình qua log và dashboard, người dùng sẽ có thể đi bộ qua và tương tác với chính các hệ thống đó.

VN AI Agent Office là bước đầu tiên hướng tới tương lai đó.
