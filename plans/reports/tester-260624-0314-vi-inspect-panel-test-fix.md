# Test Fix Report: Vietnamese UI String Migration

## Status
DONE — 43 passed / 0 failed

## Commit
`92fa3e4` — `test(vi): update inspect-panel tests to Vietnamese UI strings`

## Files Updated
- `tests/unit/agentSettingsPanel.test.ts` — 36 tests, all pass
- `tests/unit/agentBrainPanel.test.ts` — 7 tests, all pass

## String Mappings Applied

### AgentSettingsPanel (26 fixes)
| Old EN | New VI |
|---|---|
| Run commands off/ask/auto | Chạy lệnh tắt/hỏi/tự động |
| Web access | Truy cập web |
| File tools | Công cụ file |
| Open System Setup | Mở thiết lập hệ thống |
| This agent is using selected skills only. | Tác nhân này chỉ dùng các kỹ năng được chọn. |
| Search skills (labelText) | Tìm kiếm kỹ năng |
| Close (modal btn) | Đóng |
| Not supported | Không khả dụng |
| Loading skills... | Đang tải kỹ năng... |
| Run timed automation {job} now | Chạy ngay tự động hoá {job} |
| Delete timed automation {job} | Xoá tự động hoá {job} |
| No timed automations for this agent. | Chưa có tự động hoá theo lịch cho tác nhân này. |
| Create (button) | Tạo mới |
| Create automation (dialog/button) | Tạo tự động hoá |
| Weekly Review / Morning Brief / Custom | Đánh giá hàng tuần / Tóm tắt buổi sáng / Tuỳ chỉnh |
| Next / Back | Tiếp theo / Quay lại |
| Automation name / Task (labels) | Tên tự động hoá / Nhiệm vụ |
| Heartbeat automation controls are coming soon. | Điều khiển tự động hoá nhịp chạy sắp ra mắt. |
| Open Full Control UI | Mở giao diện điều khiển đầy đủ |
| Delete agent | Xoá tác nhân |
| Configure | Cấu hình |
| Enable globally | Bật toàn cục |
| Remove for all agents | Xoá cho tất cả tác nhân |
| Save BROWSER_API_KEY | Lưu BROWSER_API_KEY |

### AgentBrainPanel (5 fixes)
| Old EN | New VI |
|---|---|
| Workspace: | Không gian làm việc: |
| Save (button) | Lưu |
| Cancel (button) | Huỷ |
| Name (label) | Tên |
| This agent does not have a custom SOUL.md yet. Saving here will create the real workspace file. | Tác nhân này chưa có SOUL.md tùy chỉnh. Lưu ở đây sẽ tạo file thực trong không gian làm việc. |
| No SOUL.md yet. (placeholder) | Chưa có SOUL.md. |
| Initialize missing files | Khởi tạo file còn thiếu |

## Notes
- `"Close panel"` aria-label in AgentInspectHeader remains English — not changed (component unchanged, test passes)
- `"Agent ID is missing for this agent."` in useAgentFilesEditor hook remains English — test passes
- `"Setup browser"` dialog aria-label pattern uses `\`Setup ${skill.name}\`` which is still English in AgentSkillsSetupModal — tests referencing it pass as-is
- Behavioral assertions (aria-checked values, call args, data-testid, file names) all preserved intact
