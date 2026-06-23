import { useMemo, useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { isLocalGatewayUrl } from "@/lib/gateway/local-gateway";
import type { StudioGatewayAdapterType, StudioGatewaySettings } from "@/lib/studio/settings";
import { RunningAvatarLoader } from "@/features/agents/components/RunningAvatarLoader";

type GatewayConnectScreenProps = {
  gatewayUrl: string;
  token: string;
  selectedAdapterType: StudioGatewayAdapterType;
  activeAdapterType: StudioGatewayAdapterType;
  localGatewayDefaults: StudioGatewaySettings | null;
  status: GatewayStatus;
  error: string | null;
  showApprovalHint: boolean;
  onGatewayUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onAdapterTypeChange: (value: StudioGatewayAdapterType) => void;
  onUseLocalDefaults: () => void;
  onConnect: () => void;
};

const resolveLocalGatewayPort = (gatewayUrl: string): number => {
  try {
    const parsed = new URL(gatewayUrl);
    const port = Number(parsed.port);
    if (Number.isFinite(port) && port > 0) return port;
  } catch {}
  return 18789;
};

export const GatewayConnectScreen = ({
  gatewayUrl,
  token,
  selectedAdapterType,
  activeAdapterType,
  localGatewayDefaults,
  status,
  error,
  showApprovalHint,
  onGatewayUrlChange,
  onTokenChange,
  onAdapterTypeChange,
  onUseLocalDefaults,
  onConnect,
}: GatewayConnectScreenProps) => {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [showToken, setShowToken] = useState(false);
  const tokenOptional =
    selectedAdapterType === "hermes" ||
    selectedAdapterType === "demo" ||
    selectedAdapterType === "local" ||
    selectedAdapterType === "claw3d" ||
    selectedAdapterType === "custom";
  const isLocal = useMemo(() => isLocalGatewayUrl(gatewayUrl), [gatewayUrl]);
  const localPort = useMemo(() => resolveLocalGatewayPort(gatewayUrl), [gatewayUrl]);
  const localGatewayCommand = useMemo(
    () => `npx openclaw gateway run --bind loopback --port ${localPort} --verbose`,
    [localPort]
  );
  const localGatewayCommandPnpm = useMemo(
    () => `pnpm openclaw gateway run --bind loopback --port ${localPort} --verbose`,
    [localPort]
  );
  const localDemoCommand = useMemo(
    () => `npm run demo-gateway`,
    []
  );
  const useDemoPreset = () => {
    onAdapterTypeChange("demo");
  };
  const useHermesPreset = () => {
    onAdapterTypeChange("hermes");
  };
  const useOpenClawPreset = () => {
    onAdapterTypeChange("openclaw");
  };
  const useCustomPreset = () => {
    onAdapterTypeChange("custom");
  };
  const useLocalPreset = () => {
    onAdapterTypeChange("local");
  };
  const useClaw3dPreset = () => {
    onAdapterTypeChange("claw3d");
  };
  const statusCopy = useMemo(() => {
    if (status === "connecting" && isLocal) {
      return `Phát hiện cổng kết nối cục bộ tại cổng ${localPort}. Đang kết nối…`;
    }
    if (status === "connecting") {
      return "Đang kết nối tới cổng kết nối từ xa…";
    }
    if (isLocal) {
      return "Không tìm thấy cổng kết nối cục bộ.";
    }
    return "Chưa kết nối tới cổng kết nối.";
  }, [isLocal, localPort, status]);
  const selectedAdapterHint = useMemo(() => {
    switch (selectedAdapterType) {
      case "openclaw":
        return "OpenClaw là đường dẫn cổng kết nối phong phú nhà cung cấp. Dùng khi muốn OpenClaw quản lý định tuyến mô hình/nhà cung cấp.";
      case "hermes":
        return "Hermes là đường chạy tác nhân với luồng nhà cung cấp/tài khoản riêng phía sau cổng kết nối.";
      case "demo":
        return "Demo có thể dùng tác nhân chính cục bộ được seed sẵn, hoặc kết nối tới cổng mock tích hợp để nhận phản hồi streaming.";
      case "local":
        return "Runtime cục bộ kỳ vọng ranh giới HTTP trực tiếp runtime/orchestrator, không phải danh mục nhà cung cấp.";
      case "claw3d":
        return "Runtime VN Office giữ nguyên quy ước transcript qua đường nối runtime trực tiếp.";
      case "custom":
      default:
        return "Custom là điểm nối runtime tổng quát. Dùng cho orchestrator tương thích, không phải luồng xác thực theo nhà cung cấp.";
    }
  }, [selectedAdapterType]);
  const connectDisabled = status === "connecting";
  const connectLabel = connectDisabled ? "Đang kết nối…" : "Kết nối";
  const statusDotClass =
    status === "connected"
      ? "ui-dot-status-connected"
      : status === "connecting"
        ? "ui-dot-status-connecting"
        : "ui-dot-status-disconnected";

  const copyLocalCommand = async () => {
    try {
      await navigator.clipboard.writeText(localGatewayCommand);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1200);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    }
  };

  const commandField = (
    <div className="space-y-1.5">
      <div className="ui-command-surface flex items-center gap-2 rounded-md px-3 py-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12px] text-[var(--command-fg)]">
          {localGatewayCommand}
        </code>
        <button
          type="button"
          className="ui-btn-icon ui-command-copy h-7 w-7 shrink-0"
          onClick={copyLocalCommand}
          aria-label="Sao chép lệnh cổng kết nối cục bộ"
          title="Sao chép lệnh"
        >
          {copyStatus === "copied" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      {copyStatus === "copied" ? (
        <p className="text-xs text-muted-foreground">Đã sao chép</p>
      ) : copyStatus === "failed" ? (
        <p className="ui-text-danger text-xs">Không thể sao chép lệnh.</p>
      ) : (
        <p className="text-xs leading-snug text-muted-foreground">
          Trong source checkout, dùng <span className="font-mono text-foreground">{localGatewayCommandPnpm}</span>.
        </p>
      )}
    </div>
  );

  const remoteForm = (
    <div className="mt-2.5 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[11px] font-medium text-foreground/90">
        URL nguồn
        <input
          className="ui-input h-10 rounded-md px-4 font-sans text-sm text-foreground outline-none"
          type="text"
          value={gatewayUrl}
          onChange={(event) => onGatewayUrlChange(event.target.value)}
          placeholder="wss://your-gateway.example.com"
          spellCheck={false}
        />
      </label>

      <div className="space-y-0.5 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Dùng Tailscale?</p>
        <p>
          URL: <span className="font-mono">wss://&lt;your-tailnet-host&gt;</span>
        </p>
      </div>

      <label className="flex flex-col gap-1 text-[11px] font-medium text-foreground/90">
        {tokenOptional ? "Token nguồn (tuỳ chọn)" : "Token nguồn"}
        <div className="relative">
          <input
            className="ui-input h-10 w-full rounded-md px-4 pr-10 font-sans text-sm text-foreground outline-none"
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(event) => onTokenChange(event.target.value)}
            placeholder={tokenOptional ? "token tuỳ chọn" : "token cổng kết nối"}
            spellCheck={false}
          />
          <button
            type="button"
            className="ui-btn-icon absolute inset-y-0 right-1 my-auto h-8 w-8 border-transparent bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground"
            aria-label={showToken ? "Ẩn token" : "Hiện token"}
            onClick={() => setShowToken((prev) => !prev)}
          >
            {showToken ? (
              <EyeOff className="h-4 w-4 transition-transform duration-150" />
            ) : (
              <Eye className="h-4 w-4 transition-transform duration-150" />
            )}
          </button>
        </div>
      </label>

      <button
        type="button"
        className="ui-btn-primary mt-1 h-11 w-full px-4 text-xs font-semibold tracking-[0.05em] disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onConnect}
        disabled={connectDisabled || !gatewayUrl.trim()}
      >
        {connectLabel}
      </button>

      {status === "connecting" ? (
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <RunningAvatarLoader size={16} trackWidth={32} inline />
          Đang kết nối…
        </div>
      ) : null}
      {error ? <p className="ui-text-danger text-xs leading-snug">{error}</p> : null}
      {showApprovalHint && selectedAdapterType === "openclaw" ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
          <p className="leading-snug">
            Nếu lần kết nối đầu không thành công, hãy vào máy tính OpenClaw và phê duyệt thiết bị này:
          </p>
          <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded-md bg-[var(--command-bg)] px-2.5 py-2 font-mono text-[11px] text-[var(--command-fg)]">
            openclaw devices approve --latest
          </code>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[820px] flex-1 flex-col gap-5">
      <div className="ui-card px-4 py-2">
        <div className="flex items-center gap-2">
          {status === "connecting" ? (
            <RunningAvatarLoader size={18} trackWidth={36} inline />
          ) : (
            <span
              className={`h-2.5 w-2.5 ${statusDotClass}`}
            />
          )}
          <p className="text-sm font-semibold text-foreground">{statusCopy}</p>
        </div>
      </div>

      <div className="ui-card px-4 py-5 sm:px-6">
        <div>
          <p className="font-mono text-[10px] font-medium tracking-[0.06em] text-muted-foreground">
            Cổng kết nối từ xa (khuyến nghị)
          </p>
          <p className="mt-2 text-sm text-foreground/90">
            Chọn backend rồi kết nối tới URL cổng kết nối của nó.
          </p>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            Backend đang chọn: {selectedAdapterType} | Backend đang hoạt động: {activeAdapterType}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mỗi backend lưu URL và token riêng.
          </p>
          <p className="mt-2 text-xs leading-snug text-muted-foreground">
            {selectedAdapterHint}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em]"
              onClick={useDemoPreset}
            >
              Demo backend
            </button>
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em]"
              onClick={useHermesPreset}
            >
              Hermes backend
            </button>
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em]"
              onClick={useLocalPreset}
            >
              Local runtime
            </button>
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em]"
              onClick={useClaw3dPreset}
            >
              VN Office runtime
            </button>
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em]"
              onClick={useCustomPreset}
            >
              Custom backend
            </button>
            <button
              type="button"
              className="ui-btn-secondary px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em]"
              onClick={useOpenClawPreset}
            >
              OpenClaw backend
            </button>
          </div>
        </div>
        {remoteForm}
      </div>

      <div className="ui-card px-4 py-4 sm:px-6 sm:py-5">
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
            Chạy cục bộ (tuỳ chọn)
          </p>
          <p className="text-sm text-foreground/90">
            Khởi động tiến trình cổng kết nối cục bộ trên máy này rồi kết nối.
          </p>
        </div>
        <div className="mt-3 space-y-3">
          {commandField}
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3">
            <p className="text-xs font-medium text-foreground">Chỉ muốn xem văn phòng?</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Chạy <span className="font-mono text-foreground">{localDemoCommand}</span> để khởi động cổng mock tích hợp với các tác nhân demo.
              Sau đó chọn <span className="font-mono text-foreground">Demo backend</span> và kết nối.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3">
            <p className="text-xs font-medium text-foreground">Dùng Hermes cục bộ?</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Chạy <span className="font-mono text-foreground">npm run hermes-adapter</span>, rồi chọn
              <span className="font-mono text-foreground"> Hermes backend</span>. URL cục bộ mặc định là
              <span className="font-mono text-foreground"> ws://localhost:18789</span>.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3">
            <p className="text-xs font-medium text-foreground">Dùng runtime cục bộ hoặc tuỳ chỉnh?</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Chọn <span className="font-mono text-foreground">Local runtime</span>,
              <span className="font-mono text-foreground"> VN Office runtime</span>, hoặc
              <span className="font-mono text-foreground"> Custom backend</span> rồi trỏ URL tới
              orchestrator hoặc ranh giới runtime. Các cấu hình này đã lưu URL và token riêng.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-3">
            <p className="text-xs font-medium text-foreground">Mở VN AI Agent Office từ máy khác?</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Khởi động Studio với <span className="font-mono text-foreground">HOST=0.0.0.0</span> (hoặc
              host LAN/Tailscale cụ thể) và đặt
              <span className="font-mono text-foreground"> STUDIO_ACCESS_TOKEN</span> trước khi mở ra ngoài localhost.
              Cài đặt cổng kết nối lưu trên host Studio, phê duyệt thiết bị OpenClaw vẫn theo từng trình duyệt/thiết bị.
            </p>
          </div>
          {localGatewayDefaults ? (
            <div className="ui-input rounded-md px-3 py-3">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Dùng token từ <span className="font-mono">~/.openclaw/openclaw.json</span>.
                </p>
                <p className="font-mono text-[11px] text-foreground">
                  {localGatewayDefaults.url}
                </p>
                <button
                  type="button"
                  className="ui-btn-secondary h-9 w-full px-3 text-xs font-semibold tracking-[0.05em]"
                  onClick={onUseLocalDefaults}
                >
                  Dùng cài đặt mặc định cục bộ
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
