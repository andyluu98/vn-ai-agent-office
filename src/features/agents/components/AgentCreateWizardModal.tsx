"use client";

import { useMemo, useState } from "react";

import {
  AgentIdentityFields,
  type AgentIdentityValues,
} from "@/features/agents/components/AgentIdentityFields";
import { AgentAvatarEditorPanel } from "@/features/agents/components/AgentAvatarEditorPanel";
import {
  AGENT_FILE_META,
  AGENT_FILE_PLACEHOLDERS,
} from "@/lib/agents/agentFiles";
import {
  createEmptyPersonalityDraft,
  type PersonalityBuilderDraft,
} from "@/lib/agents/personalityBuilder";
import {
  createDefaultAgentAvatarProfile,
  type AgentAvatarProfile,
} from "@/lib/avatars/profile";
import { randomUUID } from "@/lib/uuid";

type AgentCreateWizardModalProps = {
  open: boolean;
  suggestedName?: string;
  busy?: boolean;
  submitError?: string | null;
  statusLine?: string | null;
  onClose: (createdAgentId: string | null) => void;
  onCreateAgent: (identity: AgentIdentityValues) => Promise<string | null>;
  onFinishWizard: (params: {
    agentId: string;
    draft: PersonalityBuilderDraft;
    profile: AgentAvatarProfile;
  }) => Promise<void>;
};

const stepClassName =
  "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]";

const inputClassName =
  "h-10 rounded-md border border-border/80 bg-background px-3 text-sm text-foreground outline-none";

const textAreaClassName =
  "min-h-[180px] w-full resize-y rounded-md border border-border/80 bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none";

type WizardStepId =
  | "identity"
  | "avatar"
  | "SOUL.md"
  | "AGENTS.md"
  | "USER.md"
  | "TOOLS.md"
  | "MEMORY.md"
  | "HEARTBEAT.md";

const wizardSteps: Array<{ id: WizardStepId; label: string; hint: string }> = [
  {
    id: "identity",
    label: "Danh tính",
    hint: "Tạo tác nhân trực tiếp trước, sau đó điền các bước còn lại.",
  },
  {
    id: "avatar",
    label: "Hình đại diện",
    hint: "Tuỳ chỉnh hình ảnh văn phòng trước khi viết phần còn lại của hồ sơ.",
  },
  {
    id: "SOUL.md",
    label: "Tính cách",
    hint: AGENT_FILE_META["SOUL.md"].hint,
  },
  {
    id: "AGENTS.md",
    label: "Tác nhân",
    hint: AGENT_FILE_META["AGENTS.md"].hint,
  },
  {
    id: "USER.md",
    label: "Người dùng",
    hint: AGENT_FILE_META["USER.md"].hint,
  },
  {
    id: "TOOLS.md",
    label: "Công cụ",
    hint: AGENT_FILE_META["TOOLS.md"].hint,
  },
  {
    id: "MEMORY.md",
    label: "Bộ nhớ",
    hint: AGENT_FILE_META["MEMORY.md"].hint,
  },
  {
    id: "HEARTBEAT.md",
    label: "Nhịp chạy",
    hint: AGENT_FILE_META["HEARTBEAT.md"].hint,
  },
];

const buildInitialDraft = (suggestedName: string): PersonalityBuilderDraft => {
  const draft = createEmptyPersonalityDraft();
  draft.identity.name = suggestedName.trim() || "New Agent";
  return draft;
};

const WizardField = ({
  label,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-2 text-xs text-muted-foreground">
    {label}
    <input
      className={inputClassName}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  </label>
);

const WizardTextAreaField = ({
  label,
  value,
  placeholder,
  disabled,
  rows = 6,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  onChange: (value: string) => void;
}) => (
  <label className="flex flex-col gap-2 text-xs text-muted-foreground">
    {label}
    <textarea
      className={textAreaClassName}
      value={value}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  </label>
);

export function AgentCreateWizardModal({
  open,
  suggestedName = "",
  busy = false,
  submitError = null,
  statusLine = null,
  onClose,
  onCreateAgent,
  onFinishWizard,
}: AgentCreateWizardModalProps) {
  const [step, setStep] = useState<WizardStepId>("identity");
  const [draft, setDraft] = useState<PersonalityBuilderDraft>(() =>
    buildInitialDraft(suggestedName),
  );
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [draftAvatarProfile, setDraftAvatarProfile] = useState<AgentAvatarProfile>(() =>
    createDefaultAgentAvatarProfile(randomUUID()),
  );
  const [finishing, setFinishing] = useState(false);

  const canCreate = useMemo(() => draft.identity.name.trim().length > 0, [draft.identity.name]);
  const activeStepIndex = wizardSteps.findIndex((entry) => entry.id === step);
  const activeStep = wizardSteps[activeStepIndex] ?? wizardSteps[0];
  const isWorking = busy || finishing;
  const isFinalStep = step === "HEARTBEAT.md";
  const statusCopy = finishing ? "Đang lưu file và hình đại diện của tác nhân." : statusLine;

  const updateDraft = <K extends keyof PersonalityBuilderDraft>(
    key: K,
    value: PersonalityBuilderDraft[K],
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const advanceStep = async () => {
    if (step === "identity") {
      if (!canCreate || isWorking) return;
      if (!createdAgentId) {
        const agentId = await onCreateAgent({
          name: draft.identity.name,
          creature: draft.identity.creature,
          vibe: draft.identity.vibe,
          emoji: draft.identity.emoji,
        });
        if (!agentId) return;
        setCreatedAgentId(agentId);
      }
      setStep("avatar");
      return;
    }
    if (isFinalStep) {
      if (!createdAgentId || isWorking) return;
      setFinishing(true);
      try {
        await onFinishWizard({
          agentId: createdAgentId,
          draft,
          profile: draftAvatarProfile,
        });
      } finally {
        setFinishing(false);
      }
      return;
    }
    const nextStep = wizardSteps[activeStepIndex + 1];
    if (nextStep) {
      setStep(nextStep.id);
    }
  };

  const stepActionLabel =
    step === "identity" && !createdAgentId
      ? busy
        ? "Đang tạo..."
        : "Tạo và tiếp tục"
      : isFinalStep
        ? isWorking
          ? "Đang lưu..."
          : "Hoàn thành"
        : "Tiếp theo";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-background/84 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Trình tạo tác nhân mới"
      onClick={() => {
        if (!isWorking) {
          onClose(createdAgentId);
        }
      }}
    >
      <div
        className="ui-panel flex h-[min(92vh,980px)] w-full max-w-6xl flex-col overflow-hidden shadow-xs"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border/40 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted-foreground">
                Trình tạo tác nhân mới
              </div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                Tạo tác nhân từng bước
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Bắt đầu với danh tính, sau đó hoàn thiện hồ sơ trước khi kết thúc.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="ui-btn-ghost px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isWorking}
                onClick={() => {
                  onClose(createdAgentId);
                }}
              >
                Đóng
              </button>
              {activeStepIndex > 0 ? (
                <button
                  type="button"
                  className="ui-btn-ghost px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isWorking}
                  onClick={() => {
                    const previousStep = wizardSteps[activeStepIndex - 1];
                    if (previousStep) {
                      setStep(previousStep.id);
                    }
                  }}
                >
                  Quay lại
                </button>
              ) : null}
              <button
                type="button"
                className="ui-btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                disabled={(step === "identity" && !canCreate) || isWorking}
                onClick={() => {
                  void advanceStep();
                }}
              >
                {stepActionLabel}
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {wizardSteps.map((wizardStep, index) => {
              const complete = index < activeStepIndex;
              const active = wizardStep.id === step;
              return (
                <span
                  key={wizardStep.id}
                  className={`${stepClassName} ${
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : complete
                        ? "border-emerald-400/35 bg-emerald-500/10 text-foreground"
                        : "border-border/45 bg-background/40 text-muted-foreground"
                  }`}
                >
                  {index + 1}. {wizardStep.label}
                </span>
              );
            })}
          </div>
          <div className="mt-4 text-sm text-muted-foreground">{activeStep.hint}</div>
          {statusCopy ? (
            <div className="mt-4 rounded-md border border-border/45 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              {statusCopy}
            </div>
          ) : null}
          {submitError ? (
            <div className="ui-alert-danger mt-4 rounded-md px-3 py-2 text-xs">
              {submitError}
            </div>
          ) : null}
        </div>

        {step === "identity" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
              <section className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Danh tính</h3>
                <div className="text-xs text-muted-foreground">
                  Xác nhận tên tác nhân trước, sau đó điền phần còn lại của `IDENTITY.md`.
                </div>
                <AgentIdentityFields
                  values={draft.identity}
                  disabled={isWorking}
                  onChange={(field, value) => {
                    updateDraft("identity", {
                      ...draft.identity,
                      [field]: value,
                    });
                  }}
                />
              </section>

              <div className="mt-6 rounded-xl border border-border/45 bg-muted/20 p-4 text-sm text-muted-foreground">
                Tạo tác nhân ở bước này giúp nó khả dụng ngay trên OpenClaw để trình tạo có thể lưu hồ sơ đầy đủ qua cổng kết nối ở các bước sau.
              </div>
            </div>
          </div>
        ) : createdAgentId ? (
          <>
            {step === "avatar" ? (
              <AgentAvatarEditorPanel
                agentId={createdAgentId}
                agentName={draft.identity.name.trim() || "New Agent"}
                initialProfile={draftAvatarProfile}
                showActions={false}
                onDraftChange={(profile) => {
                  setDraftAvatarProfile(profile);
                }}
                onSave={async (profile) => {
                  setDraftAvatarProfile(profile);
                }}
              />
            ) : step === "SOUL.md" ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
                <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 pb-8">
                  <section className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground">Tính cách</h3>
                    <div className="grid gap-4">
                      <WizardTextAreaField
                        label="Nguyên tắc cốt lõi"
                        value={draft.soul.coreTruths}
                        placeholder="vd: Bảo vệ thời gian của người dùng. Ưu tiên sự rõ ràng."
                        disabled={isWorking}
                        rows={5}
                        onChange={(value) => {
                          updateDraft("soul", { ...draft.soul, coreTruths: value });
                        }}
                      />
                      <WizardTextAreaField
                        label="Giới hạn"
                        value={draft.soul.boundaries}
                        placeholder="vd: Không phỏng đoán. Nói rõ khi điều gì đó chưa chắc chắn."
                        disabled={isWorking}
                        rows={5}
                        onChange={(value) => {
                          updateDraft("soul", { ...draft.soul, boundaries: value });
                        }}
                      />
                      <WizardTextAreaField
                        label="Phong cách"
                        value={draft.soul.vibe}
                        placeholder="vd: Thân thiện, trực tiếp và nhẹ nhàng vui vẻ."
                        disabled={isWorking}
                        rows={4}
                        onChange={(value) => {
                          updateDraft("soul", { ...draft.soul, vibe: value });
                        }}
                      />
                      <WizardTextAreaField
                        label="Nhất quán"
                        value={draft.soul.continuity}
                        placeholder="vd: Giữ nhất quán về tên gọi, tuỳ chọn và các quyết định trước đó."
                        disabled={isWorking}
                        rows={4}
                        onChange={(value) => {
                          updateDraft("soul", { ...draft.soul, continuity: value });
                        }}
                      />
                    </div>
                  </section>
                </div>
              </div>
            ) : step === "USER.md" ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
                <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 pb-8">
                  <section className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground">Người dùng</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <WizardField
                        label="Tên"
                        value={draft.user.name}
                        placeholder="vd: Luke"
                        disabled={isWorking}
                        onChange={(value) => {
                          updateDraft("user", { ...draft.user, name: value });
                        }}
                      />
                      <WizardField
                        label="Cách gọi"
                        value={draft.user.callThem}
                        placeholder="vd: Luke"
                        disabled={isWorking}
                        onChange={(value) => {
                          updateDraft("user", { ...draft.user, callThem: value });
                        }}
                      />
                      <WizardField
                        label="Đại từ"
                        value={draft.user.pronouns}
                        placeholder="vd: anh/ấy"
                        disabled={isWorking}
                        onChange={(value) => {
                          updateDraft("user", { ...draft.user, pronouns: value });
                        }}
                      />
                      <WizardField
                        label="Múi giờ"
                        value={draft.user.timezone}
                        placeholder="vd: Asia/Ho_Chi_Minh"
                        disabled={isWorking}
                        onChange={(value) => {
                          updateDraft("user", { ...draft.user, timezone: value });
                        }}
                      />
                      <div className="sm:col-span-2">
                        <WizardField
                          label="Ghi chú"
                          value={draft.user.notes}
                          placeholder="vd: Thích câu trả lời ngắn gọn và vòng lặp nhanh."
                          disabled={isWorking}
                          onChange={(value) => {
                            updateDraft("user", { ...draft.user, notes: value });
                          }}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <WizardTextAreaField
                          label="Bối cảnh"
                          value={draft.user.context}
                          placeholder="vd: Đang xây dựng VN AI Agent Office, thích cải tiến UI thực tế và muốn phản hồi trực tiếp."
                          disabled={isWorking}
                          rows={7}
                          onChange={(value) => {
                            updateDraft("user", { ...draft.user, context: value });
                          }}
                        />
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
                <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 pb-8">
                  <section className="space-y-3">
                    <h3 className="text-sm font-medium text-foreground">{activeStep.label}</h3>
                    <div className="text-xs text-muted-foreground">{activeStep.hint}</div>
                    <textarea
                      className={`${textAreaClassName} min-h-[56vh] font-mono`}
                      value={
                        step === "AGENTS.md"
                          ? draft.agents
                          : step === "TOOLS.md"
                            ? draft.tools
                            : step === "MEMORY.md"
                              ? draft.memory
                              : step === "HEARTBEAT.md"
                                ? draft.heartbeat
                                : ""
                      }
                      placeholder={
                        AGENT_FILE_PLACEHOLDERS[
                          step as Extract<
                            WizardStepId,
                            "AGENTS.md" | "TOOLS.md" | "MEMORY.md" | "HEARTBEAT.md"
                          >
                        ]
                      }
                      disabled={isWorking}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (step === "AGENTS.md") {
                          updateDraft("agents", nextValue);
                          return;
                        }
                        if (step === "TOOLS.md") {
                          updateDraft("tools", nextValue);
                          return;
                        }
                        if (step === "MEMORY.md") {
                          updateDraft("memory", nextValue);
                          return;
                        }
                        if (step === "HEARTBEAT.md") {
                          updateDraft("heartbeat", nextValue);
                        }
                      }}
                    />
                  </section>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
