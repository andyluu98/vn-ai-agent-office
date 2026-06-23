# Đóng góp

Cảm ơn bạn đã giúp cải thiện VN AI Agent Office.

Vui lòng dùng GitHub Issues cho bug, feature request và câu hỏi về công việc đã được lên kế hoạch.

## Trước khi bắt đầu
- Cài OpenClaw và xác nhận gateway chạy cục bộ.
- Repo này chỉ là UI và đọc config từ `~/.openclaw` với legacy fallback về `~/.moltbot` hoặc `~/.clawdbot`.
- Nó không chạy hoặc build gateway từ source.
- Đọc `CODE_DOCUMENTATION.md` để biết bản đồ code repo, điểm mở rộng và thứ tự onboarding được khuyến nghị qua codebase.
- Dùng `ROADMAP.md` nếu bạn đang tìm kiếm starter work hoặc ưu tiên ngắn hạn.

## Cài đặt cục bộ
```bash
git clone https://github.com/iamlukethedev/Claw3D.git vn-ai-agent-office
cd vn-ai-agent-office
npm install
cp .env.example .env
npm run dev
```

## Hỗ trợ và Định tuyến
- Dùng các template bug và feature GitHub cho các đóng góp công khai thông thường.
- Dùng `SUPPORT.md` để được hướng dẫn định tuyến trợ giúp và liên hệ maintainer.
- Dùng `SECURITY.md` cho các báo cáo bảo mật nhạy cảm và tránh đăng chi tiết exploit trong public issue.

## Testing
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run e2e` (yêu cầu `npx playwright install`)

Nếu thay đổi của bạn chạm đến các UX audit artifact đã được tạo, hãy dọn sạch chúng trước khi commit với `npm run cleanup:ux-artifacts`.

## Pull request
- Giữ PR tập trung và nhỏ gọn.
- Ưu tiên một nhiệm vụ mỗi PR.
- Bao gồm các test bạn đã chạy.
- Liên kết tới issue liên quan khi có thể.
- Nếu bạn thay đổi hành vi gateway, hãy nêu rõ.
- Cập nhật tài liệu khi hành vi hoặc kiến trúc hướng đến người dùng thay đổi.
- Nếu bạn chạm vào bundled asset, vendored code hoặc posture dependency/licensing, hãy cập nhật tài liệu `THIRD_PARTY_*` liên quan trong cùng PR.

## Báo cáo issue
Khi nộp issue, vui lòng bao gồm:
- Các bước tái hiện
- OS và phiên bản Node
- Bất kỳ log hoặc screenshot liên quan

## Minimal PR template
```md
## Summary
- 

## Testing
- [ ] Not run (explain why)
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run e2e`

## AI-assisted
- [ ] AI-assisted (briefly describe what and include prompts/logs if helpful)
```

## Minimal issue template
```md
## Summary

## Steps to reproduce
1.

## Expected

## Actual

## Environment
- OS:
- Node:
- UI version/commit:
- Gateway running? (yes/no)

## Logs/screenshots
```
