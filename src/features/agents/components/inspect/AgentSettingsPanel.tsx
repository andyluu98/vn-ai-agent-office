"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  ListChecks,
  Play,
  Sun,
  Trash2,
} from "lucide-react";

import { AgentSkillsPanel } from "@/features/agents/components/AgentSkillsPanel";
import { SystemSkillsPanel } from "@/features/agents/components/SystemSkillsPanel";
import { AgentInspectHeader } from "@/features/agents/components/inspect/AgentInspectHeader";
import {
  resolveExecutionRoleFromAgent,
  resolvePresetDefaultsForRole,
  type AgentPermissionsDraft,
} from "@/features/agents/operations/agentPermissionsOperation";
import type { AgentState } from "@/features/agents/state/store";
import type { CronCreateDraft, CronCreateTemplateId } from "@/lib/cron/createPayloadBuilder";
import { formatCronPayload, formatCronSchedule, type CronJobSummary } from "@/lib/cron/types";
import type { SkillStatusReport } from "@/lib/skills/types";
import type { StudioGatewayAdapterType } from "@/lib/studio/settings";

export type AgentSettingsPanelProps = {
  agent: AgentState;
  mode?: "capabilities" | "skills" | "system" | "automations" | "advanced";
  showHeader?: boolean;
  onClose: () => void;
  permissionsDraft?: AgentPermissionsDraft;
  onUpdateAgentPermissions?: (draft: AgentPermissionsDraft) => Promise<void> | void;
  onDelete: () => void;
  canDelete?: boolean;
  onToolCallingToggle: (enabled: boolean) => void;
  onThinkingTracesToggle: (enabled: boolean) => void;
  cronJobs: CronJobSummary[];
  cronLoading: boolean;
  cronError: string | null;
  cronRunBusyJobId: string | null;
  cronDeleteBusyJobId: string | null;
  onRunCronJob: (jobId: string) => Promise<void> | void;
  onDeleteCronJob: (jobId: string) => Promise<void> | void;
  cronCreateBusy?: boolean;
  onCreateCronJob?: (draft: CronCreateDraft) => Promise<void> | void;
  controlUiUrl?: string | null;
  adapterType?: StudioGatewayAdapterType | null;
  skillsReport?: SkillStatusReport | null;
  skillsLoading?: boolean;
  skillsError?: string | null;
  skillsBusy?: boolean;
  skillsBusyKey?: string | null;
  skillMessages?: Record<string, { kind: "success" | "error"; message: string }>;
  skillApiKeyDrafts?: Record<string, string>;
  defaultAgentScopeWarning?: string | null;
  systemInitialSkillKey?: string | null;
  onSystemInitialSkillHandled?: () => void;
  skillsAllowlist?: string[] | undefined;
  onSetSkillEnabled?: (skillName: string, enabled: boolean) => Promise<void> | void;
  onOpenSystemSetup?: (skillKey?: string) => void;
  onSetSkillGlobalEnabled?: (skillKey: string, enabled: boolean) => Promise<void> | void;
  onInstallSkill?: (skillKey: string, name: string, installId: string) => Promise<void> | void;
  onRemoveSkill?: (
    skill: { skillKey: string; source: string; baseDir: string }
  ) => Promise<void> | void;
  onSkillApiKeyChange?: (skillKey: string, value: string) => Promise<void> | void;
  onSaveSkillApiKey?: (skillKey: string) => Promise<void> | void;
};

const formatCronStateLine = (job: CronJobSummary): string | null => {
  if (typeof job.state.runningAtMs === "number" && Number.isFinite(job.state.runningAtMs)) {
    return "Đang chạy";
  }
  if (typeof job.state.nextRunAtMs === "number" && Number.isFinite(job.state.nextRunAtMs)) {
    return `Tiếp theo: ${new Date(job.state.nextRunAtMs).toLocaleString()}`;
  }
  if (typeof job.state.lastRunAtMs === "number" && Number.isFinite(job.state.lastRunAtMs)) {
    const status = job.state.lastStatus ? `${job.state.lastStatus} ` : "";
    return `Lần trước: ${status}${new Date(job.state.lastRunAtMs).toLocaleString()}`.trim();
  }
  return null;
};

const getFirstLinePreview = (value: string, maxChars: number): string => {
  const firstLine =
    value
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  if (!firstLine) return "";
  if (firstLine.length <= maxChars) return firstLine;
  return `${firstLine.slice(0, maxChars)}...`;
};

type CronTemplateOption = {
  id: CronCreateTemplateId;
  title: string;
  description: string;
  icon: typeof Sun;
};

const CRON_TEMPLATE_OPTIONS: CronTemplateOption[] = [
  {
    id: "morning-brief",
    title: "Tóm tắt buổi sáng",
    description: "Tóm tắt trạng thái hằng ngày với cập nhật qua đêm.",
    icon: Sun,
  },
  {
    id: "reminder",
    title: "Nhắc nhở",
    description: "Nhắc nhở theo thời gian cho sự kiện hoặc nhiệm vụ cụ thể.",
    icon: Bell,
  },
  {
    id: "weekly-review",
    title: "Đánh giá hàng tuần",
    description: "Tổng hợp định kỳ trong khoảng thời gian dài hơn.",
    icon: CalendarDays,
  },
  {
    id: "inbox-triage",
    title: "Phân loại hộp thư",
    description: "Sắp xếp và tóm tắt định kỳ các cập nhật đến.",
    icon: ListChecks,
  },
  {
    id: "custom",
    title: "Tuỳ chỉnh",
    description: "Bắt đầu từ luồng trống và chọn từng cài đặt.",
    icon: ListChecks,
  },
];

const TIMED_AUTOMATION_STEP_META: Array<{ title: string; indicator: string }> = [
  { title: "Chọn loại", indicator: "Loại" },
  { title: "Định nghĩa chức năng", indicator: "Chức năng" },
  { title: "Đặt thời gian", indicator: "Thời gian" },
  { title: "Xem lại và tạo", indicator: "Xem lại" },
];

const resolveLocalTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const createInitialCronDraft = (): CronCreateDraft => ({
  templateId: "morning-brief",
  name: "",
  taskText: "",
  scheduleKind: "every",
  everyAmount: 30,
  everyUnit: "minutes",
  everyAtTime: "09:00",
  everyTimeZone: resolveLocalTimeZone(),
  deliveryMode: "none",
  deliveryChannel: "last",
});

const arePermissionsDraftEqual = (a: AgentPermissionsDraft, b: AgentPermissionsDraft): boolean =>
  a.commandMode === b.commandMode &&
  a.webAccess === b.webAccess &&
  a.fileTools === b.fileTools;

const applyTemplateDefaults = (templateId: CronCreateTemplateId, current: CronCreateDraft): CronCreateDraft => {
  const nextTimeZone = (current.everyTimeZone ?? "").trim() || resolveLocalTimeZone();
  const base = {
    ...createInitialCronDraft(),
    deliveryMode: current.deliveryMode ?? "none",
    deliveryChannel: current.deliveryChannel || "last",
    deliveryTo: current.deliveryTo,
    advancedSessionTarget: current.advancedSessionTarget,
    advancedWakeMode: current.advancedWakeMode,
    everyTimeZone: nextTimeZone,
  } satisfies CronCreateDraft;

  if (templateId === "morning-brief") {
    return {
      ...base,
      templateId,
      name: "Morning brief",
      taskText: "Summarize overnight updates and priorities.",
      scheduleKind: "every",
      everyAmount: 1,
      everyUnit: "days",
      everyAtTime: "07:00",
    };
  }
  if (templateId === "reminder") {
    return {
      ...base,
      templateId,
      name: "Reminder",
      taskText: "Reminder: follow up on today's priority task.",
      scheduleKind: "at",
      scheduleAt: "",
    };
  }
  if (templateId === "weekly-review") {
    return {
      ...base,
      templateId,
      name: "Weekly review",
      taskText: "Summarize wins, blockers, and next-week priorities.",
      scheduleKind: "every",
      everyAmount: 7,
      everyUnit: "days",
      everyAtTime: "09:00",
    };
  }
  if (templateId === "inbox-triage") {
    return {
      ...base,
      templateId,
      name: "Inbox triage",
      taskText: "Triage unread updates and surface the top actions.",
      scheduleKind: "every",
      everyAmount: 30,
      everyUnit: "minutes",
    };
  }
  return {
    ...base,
    templateId: "custom",
    name: "",
    taskText: "",
    scheduleKind: "every",
    everyAmount: 30,
    everyUnit: "minutes",
  };
};

export const AgentSettingsPanel = ({
  agent,
  mode = "capabilities",
  showHeader = true,
  onClose,
  permissionsDraft,
  onUpdateAgentPermissions = () => {},
  onDelete,
  canDelete = true,
  cronJobs,
  cronLoading,
  cronError,
  cronRunBusyJobId,
  cronDeleteBusyJobId,
  onRunCronJob,
  onDeleteCronJob,
  cronCreateBusy = false,
  onCreateCronJob = () => {},
  controlUiUrl = null,
  adapterType = "openclaw",
  skillsReport = null,
  skillsLoading = false,
  skillsError = null,
  skillsBusy = false,
  skillsBusyKey = null,
  skillMessages = {},
  skillApiKeyDrafts = {},
  defaultAgentScopeWarning = null,
  systemInitialSkillKey = null,
  onSystemInitialSkillHandled = () => {},
  skillsAllowlist,
  onSetSkillEnabled = () => {},
  onOpenSystemSetup = () => {},
  onSetSkillGlobalEnabled = () => {},
  onInstallSkill = () => {},
  onRemoveSkill = () => {},
  onSkillApiKeyChange = () => {},
  onSaveSkillApiKey = () => {},
}: AgentSettingsPanelProps) => {
  const isOpenClawRuntime = adapterType === "openclaw";
  const initialPermissionsDraft =
    permissionsDraft ?? resolvePresetDefaultsForRole(resolveExecutionRoleFromAgent(agent));
  const [permissionsBaselineValue, setPermissionsBaselineValue] =
    useState<AgentPermissionsDraft>(initialPermissionsDraft);
  const [permissionsDraftValue, setPermissionsDraftValue] =
    useState<AgentPermissionsDraft>(initialPermissionsDraft);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionsSaveState, setPermissionsSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [permissionsSaveError, setPermissionsSaveError] = useState<string | null>(null);
  const permissionsSaveTimerRef = useRef<number | null>(null);
  const permissionsDraftAgentIdRef = useRef(agent.agentId);
  const [expandedCronJobIds, setExpandedCronJobIds] = useState<Set<string>>(() => new Set());
  const [cronCreateOpen, setCronCreateOpen] = useState(false);
  const [cronCreateStep, setCronCreateStep] = useState(0);
  const [cronCreateError, setCronCreateError] = useState<string | null>(null);
  const [cronDraft, setCronDraft] = useState<CronCreateDraft>(createInitialCronDraft);

  const resolvedExecutionRole = useMemo(() => resolveExecutionRoleFromAgent(agent), [agent]);
  const resolvedPermissionsDraft = useMemo(
    () => permissionsDraft ?? resolvePresetDefaultsForRole(resolvedExecutionRole),
    [permissionsDraft, resolvedExecutionRole]
  );
  const permissionsDirty = useMemo(
    () => !arePermissionsDraftEqual(permissionsDraftValue, permissionsBaselineValue),
    [permissionsBaselineValue, permissionsDraftValue]
  );

  useEffect(() => {
    const agentChanged = permissionsDraftAgentIdRef.current !== agent.agentId;
    permissionsDraftAgentIdRef.current = agent.agentId;
    setPermissionsBaselineValue(resolvedPermissionsDraft);
    if (!agentChanged && (permissionsSaving || permissionsDirty)) {
      return;
    }
    setPermissionsDraftValue(resolvedPermissionsDraft);
    setPermissionsSaveState("idle");
    setPermissionsSaveError(null);
    setPermissionsSaving(false);
  }, [agent.agentId, permissionsDirty, permissionsSaving, resolvedPermissionsDraft]);

  const runPermissionsSave = useCallback(
    async (draft: AgentPermissionsDraft) => {
      if (permissionsSaving) return;
      setPermissionsSaving(true);
      setPermissionsSaveState("saving");
      setPermissionsSaveError(null);
      try {
        await onUpdateAgentPermissions(draft);
        setPermissionsSaveState("saved");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save permissions.";
        setPermissionsSaveState("error");
        setPermissionsSaveError(message);
      } finally {
        setPermissionsSaving(false);
      }
    },
    [onUpdateAgentPermissions, permissionsSaving]
  );

  useEffect(() => {
    return () => {
      if (permissionsSaveTimerRef.current !== null) {
        window.clearTimeout(permissionsSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!permissionsDirty) return;
    if (permissionsSaving) return;
    if (permissionsSaveTimerRef.current !== null) {
      window.clearTimeout(permissionsSaveTimerRef.current);
    }
    setPermissionsSaveState("idle");
    permissionsSaveTimerRef.current = window.setTimeout(() => {
      permissionsSaveTimerRef.current = null;
      void runPermissionsSave(permissionsDraftValue);
    }, 450);
    return () => {
      if (permissionsSaveTimerRef.current !== null) {
        window.clearTimeout(permissionsSaveTimerRef.current);
        permissionsSaveTimerRef.current = null;
      }
    };
  }, [permissionsDirty, permissionsDraftValue, permissionsSaving, runPermissionsSave]);

  const openCronCreate = () => {
    setCronCreateOpen(true);
    setCronCreateStep(0);
    setCronCreateError(null);
    setCronDraft(createInitialCronDraft());
  };

  const closeCronCreate = () => {
    setCronCreateOpen(false);
    setCronCreateStep(0);
    setCronCreateError(null);
    setCronDraft(createInitialCronDraft());
  };

  const updateCronDraft = (patch: Partial<CronCreateDraft>) => {
    setCronDraft((prev) => ({ ...prev, ...patch }));
  };

  const selectCronTemplate = (templateId: CronCreateTemplateId) => {
    setCronDraft((prev) => applyTemplateDefaults(templateId, prev));
  };

  const canMoveToScheduleStep = cronDraft.name.trim().length > 0 && cronDraft.taskText.trim().length > 0;
  const canMoveToReviewStep =
    cronDraft.scheduleKind === "every"
      ? Number.isFinite(cronDraft.everyAmount) &&
        (cronDraft.everyAmount ?? 0) > 0 &&
        (cronDraft.everyUnit !== "days" ||
          ((cronDraft.everyAtTime ?? "").trim().length > 0 &&
            (cronDraft.everyTimeZone ?? "").trim().length > 0))
      : (cronDraft.scheduleAt ?? "").trim().length > 0;
  const canSubmitCronCreate = canMoveToScheduleStep && canMoveToReviewStep;

  const submitCronCreate = async () => {
    if (cronCreateBusy || !canSubmitCronCreate) {
      return;
    }
    setCronCreateError(null);
    const payload: CronCreateDraft = {
      templateId: cronDraft.templateId,
      name: cronDraft.name.trim(),
      taskText: cronDraft.taskText.trim(),
      scheduleKind: cronDraft.scheduleKind,
      ...(typeof cronDraft.everyAmount === "number" ? { everyAmount: cronDraft.everyAmount } : {}),
      ...(cronDraft.everyUnit ? { everyUnit: cronDraft.everyUnit } : {}),
      ...(cronDraft.everyUnit === "days" && cronDraft.everyAtTime
        ? { everyAtTime: cronDraft.everyAtTime }
        : {}),
      ...(cronDraft.everyUnit === "days" && cronDraft.everyTimeZone
        ? { everyTimeZone: cronDraft.everyTimeZone }
        : {}),
      ...(cronDraft.scheduleAt ? { scheduleAt: cronDraft.scheduleAt } : {}),
      ...(cronDraft.deliveryMode ? { deliveryMode: cronDraft.deliveryMode } : {}),
      ...(cronDraft.deliveryChannel ? { deliveryChannel: cronDraft.deliveryChannel } : {}),
      ...(cronDraft.deliveryTo ? { deliveryTo: cronDraft.deliveryTo } : {}),
      ...(cronDraft.advancedSessionTarget
        ? { advancedSessionTarget: cronDraft.advancedSessionTarget }
        : {}),
      ...(cronDraft.advancedWakeMode ? { advancedWakeMode: cronDraft.advancedWakeMode } : {}),
    };
    try {
      await onCreateCronJob(payload);
      closeCronCreate();
    } catch (err) {
      setCronCreateError(err instanceof Error ? err.message : "Failed to create automation.");
    }
  };

  const moveCronCreateBack = () => {
    setCronCreateStep((prev) => Math.max(0, prev - 1));
  };

  const moveCronCreateNext = () => {
    if (cronCreateStep === 0) {
      setCronCreateStep(1);
      return;
    }
    if (cronCreateStep === 1 && canMoveToScheduleStep) {
      setCronCreateStep(2);
      return;
    }
    if (cronCreateStep === 2 && canMoveToReviewStep) {
      setCronCreateStep(3);
    }
  };

  const panelLabel =
    mode === "advanced"
      ? "Nâng cao"
      : mode === "skills"
        ? "Kỹ năng"
        : mode === "system"
          ? "Cài đặt hệ thống"
          : "";
  const canOpenControlUi = typeof controlUiUrl === "string" && controlUiUrl.trim().length > 0;
  const timedAutomationStepMeta =
    TIMED_AUTOMATION_STEP_META[cronCreateStep] ??
    TIMED_AUTOMATION_STEP_META[TIMED_AUTOMATION_STEP_META.length - 1];

  return (
    <div
      className="agent-inspect-panel"
      data-testid="agent-settings-panel"
      style={{ position: "relative", left: "auto", top: "auto", width: "100%", height: "100%" }}
    >
      {showHeader ? (
        <AgentInspectHeader
          label={panelLabel}
          title={agent.name}
          onClose={onClose}
          closeTestId="agent-settings-close"
        />
      ) : null}

      <div className="flex flex-col gap-0 px-5 pb-5">
        {mode === "capabilities" ? (
          <section className="sidebar-section" data-testid="agent-settings-permissions">
            <div className="mt-2 flex flex-col gap-8">
              <div className="px-1 py-1">
                <div className="sidebar-copy flex flex-col gap-1 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/88">Chạy lệnh</span>
                  <div
                    className="ui-segment ui-segment-command-mode mt-2 grid-cols-3"
                    role="group"
                    aria-label="Chạy lệnh"
                  >
                    {(
                      [
                        { id: "off", label: "Tắt" },
                        { id: "ask", label: "Hỏi" },
                        { id: "auto", label: "Tự động" },
                      ] as const
                    ).map((option) => {
                      const selected = permissionsDraftValue.commandMode === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-label={`Chạy lệnh ${option.label.toLowerCase()}`}
                          aria-pressed={selected}
                          className="ui-segment-item px-3 py-2.5 text-center font-mono text-[11px] font-semibold tracking-[0.04em]"
                          data-active={selected ? "true" : "false"}
                          onClick={() =>
                            setPermissionsDraftValue((current) => ({
                              ...current,
                              commandMode: option.id,
                            }))
                          }
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="ui-settings-row flex min-h-[68px] items-center justify-between gap-6 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-label="Truy cập web"
                    aria-checked={permissionsDraftValue.webAccess}
                    className={`ui-switch self-center ${permissionsDraftValue.webAccess ? "ui-switch--on" : ""}`}
                    onClick={() =>
                      setPermissionsDraftValue((current) => ({
                        ...current,
                        webAccess: !current.webAccess,
                      }))
                    }
                  >
                    <span className="ui-switch-thumb" />
                  </button>
                  <div className="sidebar-copy flex flex-col">
                    <span className="text-[11px] font-medium text-foreground/88">Truy cập web</span>
                    <span className="text-[10px] text-muted-foreground/70">
                      Cho phép tác nhân này tìm kết quả web trực tiếp.
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/55" aria-hidden="true" />
              </div>
              <div className="ui-settings-row flex min-h-[68px] items-center justify-between gap-6 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-label="Công cụ file"
                    aria-checked={permissionsDraftValue.fileTools}
                    className={`ui-switch self-center ${permissionsDraftValue.fileTools ? "ui-switch--on" : ""}`}
                    onClick={() =>
                      setPermissionsDraftValue((current) => ({
                        ...current,
                        fileTools: !current.fileTools,
                      }))
                    }
                  >
                    <span className="ui-switch-thumb" />
                  </button>
                  <div className="sidebar-copy flex flex-col">
                    <span className="text-[11px] font-medium text-foreground/88">Công cụ file</span>
                    <span className="text-[10px] text-muted-foreground/70">
                      Cho phép tác nhân đọc và chỉnh sửa file trong không gian làm việc của nó.
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/55" aria-hidden="true" />
              </div>
              <div className="ui-settings-row flex min-h-[68px] items-center justify-between gap-6 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-label="Tự động hoá trình duyệt"
                    aria-checked="false"
                    className="ui-switch self-center"
                    disabled
                  >
                    <span className="ui-switch-thumb" />
                  </button>
                  <div className="sidebar-copy flex flex-col">
                    <span className="text-[11px] font-medium text-foreground/88">Tự động hoá trình duyệt</span>
                    <span className="text-[10px] text-muted-foreground/70">Sắp ra mắt</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/55" aria-hidden="true" />
              </div>
            </div>
            <div className="sidebar-copy mt-3 text-[11px] text-muted-foreground">
              {permissionsSaveState === "saving" ? "Đang lưu..." : null}
              {permissionsSaveState === "saved" ? "Đã lưu." : null}
              {permissionsSaveState === "error" && permissionsSaveError ? (
                <span>
                  Không thể lưu. {permissionsSaveError}{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => {
                      void runPermissionsSave(permissionsDraftValue);
                    }}
                  >
                    Thử lại
                  </button>
                </span>
              ) : null}
            </div>
            {permissionsSaveState === "error" && !permissionsSaveError ? (
              <div className="ui-alert-danger mt-3 rounded-md px-3 py-2 text-xs">
                Không thể lưu quyền hạn.
              </div>
            ) : null}
          </section>
        ) : null}

        {mode === "skills" ? (
          <AgentSkillsPanel
            skillsReport={skillsReport}
            skillsLoading={skillsLoading}
            skillsError={skillsError}
            skillsBusy={skillsBusy}
            skillsBusyKey={skillsBusyKey}
            skillsAllowlist={skillsAllowlist}
            onSetSkillEnabled={onSetSkillEnabled}
            onOpenSystemSetup={onOpenSystemSetup}
          />
        ) : null}

        {mode === "system" ? (
          <SystemSkillsPanel
            skillsReport={skillsReport}
            skillsLoading={skillsLoading}
            skillsError={skillsError}
            skillsBusy={skillsBusy}
            skillsBusyKey={skillsBusyKey}
            skillMessages={skillMessages}
            skillApiKeyDrafts={skillApiKeyDrafts}
            defaultAgentScopeWarning={defaultAgentScopeWarning}
            initialSkillKey={systemInitialSkillKey}
            onInitialSkillKeyHandled={onSystemInitialSkillHandled}
            onSetSkillGlobalEnabled={onSetSkillGlobalEnabled}
            onInstallSkill={onInstallSkill}
            onRemoveSkill={onRemoveSkill}
            onSkillApiKeyChange={onSkillApiKeyChange}
            onSaveSkillApiKey={onSaveSkillApiKey}
          />
        ) : null}

        {mode === "automations" ? (
          <section className="sidebar-section" data-testid="agent-settings-cron">
            <div className="flex items-center justify-between gap-2">
              <h3 className="sidebar-section-title">Tự động hoá theo lịch</h3>
              {!cronLoading && !cronError && cronJobs.length > 0 ? (
                <button
                  className="sidebar-btn-ghost px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={openCronCreate}
                >
                  Tạo mới
                </button>
              ) : null}
            </div>
            {cronLoading ? (
              <div className="mt-3 text-[11px] text-muted-foreground">Đang tải tự động hoá theo lịch...</div>
            ) : null}
            {!cronLoading && cronError ? (
              <div className="ui-alert-danger mt-3 rounded-md px-3 py-2 text-xs">
                {cronError}
              </div>
            ) : null}
            {!cronLoading && !cronError && cronJobs.length === 0 ? (
              <div className="sidebar-card mt-3 flex flex-col items-center justify-center gap-4 px-5 py-6 text-center">
                <CalendarDays
                  className="h-4 w-4 text-muted-foreground/70"
                  aria-hidden="true"
                  data-testid="cron-empty-icon"
                />
                <div className="sidebar-copy text-[11px] text-muted-foreground/82">
                  Chưa có tự động hoá theo lịch cho tác nhân này.
                </div>
                <button
                  className="sidebar-btn-primary mt-2 w-auto min-w-[116px] self-center px-4 py-2 font-mono text-[10px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={openCronCreate}
                >
                  Tạo mới
                </button>
              </div>
            ) : null}
            {!cronLoading && !cronError && cronJobs.length > 0 ? (
              <div className="mt-3 flex flex-col gap-3">
                {cronJobs.map((job) => {
                  const runBusy = cronRunBusyJobId === job.id;
                  const deleteBusy = cronDeleteBusyJobId === job.id;
                  const busy = runBusy || deleteBusy;
                  const scheduleText = formatCronSchedule(job.schedule);
                  const payloadText = formatCronPayload(job.payload).trim();
                  const payloadPreview = getFirstLinePreview(payloadText, 160);
                  const payloadExpandable =
                    payloadText.length > payloadPreview.length || payloadText.split("\n").length > 1;
                  const expanded = expandedCronJobIds.has(job.id);
                  const stateLine = formatCronStateLine(job);
                  return (
                    <div
                      key={job.id}
                      className="group/cron ui-card flex items-start justify-between gap-2 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <div className="min-w-0 flex-1 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                            {job.name}
                          </div>
                          {!job.enabled ? (
                            <div className="shrink-0 rounded-md bg-muted/50 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-2xs">
                              Disabled
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Tần suất
                          </span>
                          <div className="break-words">{scheduleText}</div>
                        </div>
                        {stateLine ? (
                          <div className="mt-1 break-words text-[11px] text-muted-foreground">
                            {stateLine}
                          </div>
                        ) : null}
                        {payloadText ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Nhiệm vụ
                              </span>
                              {payloadExpandable ? (
                                <button
                                  className="ui-btn-secondary shrink-0 min-h-0 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-[0.06em] text-muted-foreground"
                                  type="button"
                                  onClick={() => {
                                    setExpandedCronJobIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(job.id)) {
                                        next.delete(job.id);
                                      } else {
                                        next.add(job.id);
                                      }
                                      return next;
                                    });
                                  }}
                                >
                                  {expanded ? "Thu gọn" : "Xem thêm"}
                                </button>
                              ) : null}
                            </div>
                            <div className="mt-0.5 whitespace-pre-wrap break-words" title={payloadText}>
                              {expanded ? payloadText : payloadPreview || payloadText}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition group-focus-within/cron:opacity-100 group-hover/cron:opacity-100">
                        <button
                          className="ui-btn-icon h-7 w-7 disabled:cursor-not-allowed disabled:opacity-60"
                          type="button"
                          aria-label={`Chạy ngay tự động hoá ${job.name}`}
                          onClick={() => {
                            void onRunCronJob(job.id);
                          }}
                          disabled={busy}
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="ui-btn-icon ui-btn-icon-danger h-7 w-7 bg-transparent disabled:cursor-not-allowed disabled:opacity-60"
                          type="button"
                          aria-label={`Xoá tự động hoá ${job.name}`}
                          onClick={() => {
                            void onDeleteCronJob(job.id);
                          }}
                          disabled={busy}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {isOpenClawRuntime ? (
              <section className="sidebar-section" data-testid="agent-settings-heartbeat-coming-soon">
                <h3 className="sidebar-section-title">Nhịp chạy</h3>
                <div className="mt-3 text-[11px] text-muted-foreground">
                  Điều khiển tự động hoá nhịp chạy sắp ra mắt.
                </div>
              </section>
            ) : null}
          </section>
        ) : null}

        {mode === "advanced" ? (
          <>
            {isOpenClawRuntime ? (
              <section className="sidebar-section mt-8" data-testid="agent-settings-control-ui">
                <h3 className="sidebar-section-title ui-text-danger">Vùng nguy hiểm</h3>
                <div className="ui-alert-danger mt-3 rounded-md px-3 py-3 text-[11px]">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <div className="space-y-1">
                      <div className="font-medium">Chỉ dành cho người dùng nâng cao.</div>
                      <div>Mở giao diện điều khiển OpenClaw đầy đủ bên ngoài Studio.</div>
                      <div>Thay đổi ở đó có thể làm hỏng hành vi tác nhân hoặc khiến Studio mất đồng bộ.</div>
                    </div>
                  </div>
                </div>
                {canOpenControlUi ? (
                  <a
                    className="sidebar-btn-primary ui-btn-danger mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-center font-mono text-[10px] font-semibold tracking-[0.06em]"
                    href={controlUiUrl ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Mở giao diện điều khiển đầy đủ
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ) : (
                  <>
                    <button
                      className="sidebar-btn-primary ui-btn-danger mt-3 inline-flex px-3 py-2.5 font-mono text-[10px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-65"
                      type="button"
                      disabled
                    >
                      Mở giao diện điều khiển đầy đủ
                    </button>
                    <div className="mt-2 text-[10px] text-muted-foreground/70">
                      Liên kết giao diện điều khiển không khả dụng cho cổng kết nối này.
                    </div>
                  </>
                )}
              </section>
            ) : null}

            {canDelete ? (
              <section className="sidebar-section mt-8">
                <div className="text-[11px] text-muted-foreground/68">
                  Xoá tác nhân khỏi cấu hình cổng kết nối và xoá các tự động hoá đã lên lịch của nó.
                </div>
                <button
                  className="sidebar-btn-ghost ui-btn-danger mt-3 inline-flex px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.06em]"
                  type="button"
                  onClick={onDelete}
                >
                  Xoá tác nhân
                </button>
              </section>
            ) : (
              <section className="sidebar-section mt-8">
                <h3 className="sidebar-section-title">Tác nhân hệ thống</h3>
                <div className="mt-3 text-[11px] text-muted-foreground">
                  Tác nhân chính được bảo lưu và không thể xoá.
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>

      {cronCreateOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Tạo tự động hoá"
          onClick={closeCronCreate}
        >
          <div
            className="ui-panel w-full max-w-2xl bg-card shadow-xs"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-6 py-5">
              <div className="min-w-0">
                <div className="text-[11px] font-medium tracking-[0.01em] text-muted-foreground/80">
                  Trình tạo tự động hoá theo lịch
                </div>
                <div className="mt-1 text-base font-semibold text-foreground">
                  {timedAutomationStepMeta.title}
                </div>
              </div>
              <button
                type="button"
                className="sidebar-btn-ghost px-3 font-mono text-[10px] font-semibold tracking-[0.06em]"
                onClick={closeCronCreate}
              >
                Đóng
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              {cronCreateError ? (
                <div className="ui-alert-danger rounded-md px-3 py-2 text-xs">
                  {cronCreateError}
                </div>
              ) : null}
              {cronCreateStep === 0 ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Chọn mẫu để bắt đầu nhanh, hoặc chọn Tuỳ chỉnh.
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {CRON_TEMPLATE_OPTIONS.map((option) => {
                      const active = option.id === cronDraft.templateId;
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-label={option.title}
                          className={`ui-card px-3 py-3 text-left transition ${
                            active ? "ui-selected" : "bg-surface-2/60 hover:bg-surface-3/90"
                          }`}
                          onClick={() => selectCronTemplate(option.id)}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-foreground" />
                            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                              {option.title}
                            </div>
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {option.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {cronCreateStep === 1 ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Đặt tên và mô tả những gì tự động hoá này nên làm.
                  </div>
                  <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                      Tên tự động hoá
                    </span>
                    <input
                      aria-label="Tên tự động hoá"
                      className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                      value={cronDraft.name}
                      onChange={(event) => updateCronDraft({ name: event.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                      Nhiệm vụ
                    </span>
                    <textarea
                      aria-label="Nhiệm vụ"
                      className="min-h-28 rounded-md border border-border bg-surface-3 px-3 py-2 text-sm text-foreground outline-none"
                      value={cronDraft.taskText}
                      onChange={(event) => updateCronDraft({ taskText: event.target.value })}
                    />
                  </label>
                </div>
              ) : null}
              {cronCreateStep === 2 ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">Chọn thời điểm chạy.</div>
                  <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                      Loại lịch
                    </span>
                    <select
                      className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                      value={cronDraft.scheduleKind}
                      onChange={(event) =>
                        updateCronDraft({
                          scheduleKind: event.target.value as CronCreateDraft["scheduleKind"],
                        })
                      }
                    >
                      <option value="every">Mỗi</option>
                      <option value="at">Một lần</option>
                    </select>
                  </label>
                  {cronDraft.scheduleKind === "every" ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                          Mỗi
                        </span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                          value={String(cronDraft.everyAmount ?? 30)}
                          onChange={(event) =>
                            updateCronDraft({
                              everyAmount: Number.parseInt(event.target.value, 10) || 0,
                            })
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                          Đơn vị
                        </span>
                        <select
                          className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                          value={cronDraft.everyUnit ?? "minutes"}
                          onChange={(event) =>
                            updateCronDraft({
                              everyUnit: event.target.value as CronCreateDraft["everyUnit"],
                            })
                          }
                        >
                          <option value="minutes">Phút</option>
                          <option value="hours">Giờ</option>
                          <option value="days">Ngày</option>
                        </select>
                      </label>
                      {cronDraft.everyUnit === "days" ? (
                        <>
                          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                              Thời điểm trong ngày
                            </span>
                            <input
                              type="time"
                              className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                              value={cronDraft.everyAtTime ?? "09:00"}
                              onChange={(event) => updateCronDraft({ everyAtTime: event.target.value })}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                              Múi giờ
                            </span>
                            <input
                              className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                              value={cronDraft.everyTimeZone ?? resolveLocalTimeZone()}
                              onChange={(event) =>
                                updateCronDraft({ everyTimeZone: event.target.value })
                              }
                            />
                          </label>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  {cronDraft.scheduleKind === "at" ? (
                    <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                        Chạy lúc
                      </span>
                      <input
                        type="datetime-local"
                        className="h-10 rounded-md border border-border bg-surface-3 px-3 text-sm text-foreground outline-none"
                        value={cronDraft.scheduleAt ?? ""}
                        onChange={(event) => updateCronDraft({ scheduleAt: event.target.value })}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
              {cronCreateStep === 3 ? (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div>Xem lại chi tiết trước khi tạo tự động hoá này.</div>
                  <div className="ui-card px-3 py-2">
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                      {cronDraft.name || "Tự động hoá chưa đặt tên"}
                    </div>
                    <div className="mt-1 text-[11px]">
                      {cronDraft.taskText || "Chưa có nhiệm vụ."}
                    </div>
                    <div className="mt-2 text-[11px]">
                      Lịch:{" "}
                      {cronDraft.scheduleKind === "every"
                        ? `Every ${cronDraft.everyAmount ?? 0} ${cronDraft.everyUnit ?? "minutes"}${
                            cronDraft.everyUnit === "days"
                              ? ` at ${cronDraft.everyAtTime ?? ""} (${cronDraft.everyTimeZone ?? resolveLocalTimeZone()})`
                              : ""
                          }`
                        : `At ${cronDraft.scheduleAt ?? ""}`}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border/50 px-5 pb-4 pt-5">
              <div className="text-[11px] text-muted-foreground">
                {timedAutomationStepMeta.indicator} · Bước {cronCreateStep + 1} / 4
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="sidebar-btn-ghost px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={moveCronCreateBack}
                  disabled={cronCreateStep === 0 || cronCreateBusy}
                >
                  Quay lại
                </button>
                {cronCreateStep < 3 ? (
                  <button
                    type="button"
                    className="sidebar-btn-ghost px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={moveCronCreateNext}
                    disabled={
                      cronCreateBusy ||
                      (cronCreateStep === 1 && !canMoveToScheduleStep) ||
                      (cronCreateStep === 2 && !canMoveToReviewStep)
                    }
                  >
                    Tiếp theo
                  </button>
                ) : null}
                {cronCreateStep === 3 ? (
                  <button
                    type="button"
                    className="sidebar-btn-primary px-3 py-2 font-mono text-[10px] font-semibold tracking-[0.06em] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
                    onClick={() => {
                      void submitCronCreate();
                    }}
                    disabled={cronCreateBusy || !canSubmitCronCreate}
                  >
                    Tạo tự động hoá
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
