/**
 * AgentsStep — Shows discovered agents after gateway connection.
 */
import { Bot, Users, WifiOff } from "lucide-react";

export type AgentsStepProps = {
  agentCount: number;
  connected: boolean;
};

export const AgentsStep = ({ agentCount, connected }: AgentsStepProps) => {
  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        <WifiOff className="h-8 w-8 text-white/30" />
        <p className="text-sm text-white/60">
          Kết nối tới cổng kết nối trước để khám phá các tác nhân.
        </p>
      </div>
    );
  }

  if (agentCount === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
            <Bot className="h-6 w-6 text-white/40" />
          </div>
          <p className="text-sm font-medium text-white">Không tìm thấy tác nhân</p>
          <p className="max-w-xs text-center text-xs text-white/55">
            Cổng kết nối đã kết nối nhưng chưa có tác nhân nào được cấu hình.
            Bạn có thể tạo tác nhân từ thanh bên danh sách tác nhân của VN AI Agent Office sau khi hoàn thành hướng dẫn này.
          </p>
        </div>

        <div className="rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
          <p className="text-xs font-medium text-white/80">Bắt đầu nhanh:</p>
          <ol className="mt-2 space-y-1.5 text-[11px] text-white/55">
            <li>1. Nhấn nút + trong thanh bên danh sách tác nhân</li>
            <li>2. Đặt tên và chọn mô hình cho tác nhân</li>
            <li>3. Cấu hình kỹ năng và tính cách</li>
            <li>4. Xem tác nhân xuất hiện tại bàn làm việc!</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
        <Users className="h-5 w-5 text-amber-300" />
        <div>
          <p className="text-sm font-semibold text-white">
            Đã phát hiện {agentCount} tác nhân
          </p>
          <p className="text-[11px] text-white/55">
            Đội AI của bạn đang sẵn sàng trong văn phòng.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-white/70">
          Bạn có thể làm gì với tác nhân:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Trò chuyện", desc: "Gửi tin nhắn và nhận phản hồi" },
            { label: "Phê duyệt", desc: "Xem xét và phê duyệt lệnh thực thi" },
            { label: "Cấu hình", desc: "Chỉnh sửa file não và cài đặt" },
            { label: "Theo dõi", desc: "Xem hoạt động runtime theo thời gian thực" },
          ].map(({ label, desc }) => (
            <div
              key={label}
              className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2"
            >
              <p className="text-[11px] font-semibold text-white">{label}</p>
              <p className="text-[10px] text-white/45">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
