"use client";

import { useMemo, useState } from "react";

import {
  Download,
  ExternalLink,
  RefreshCcw,
  Settings2,
  Shield,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";

import type { OfficeSkillsMarketplaceController } from "@/features/office/hooks/useOfficeSkillsMarketplace";
import type { SkillMarketplaceCollectionId, SkillMarketplaceEntry } from "@/lib/skills/marketplace";
import { buildSkillMarketplaceCollections } from "@/lib/skills/marketplace";
import { buildAgentSkillsAllowlistSet, deriveAgentSkillsAccessMode } from "@/lib/skills/presentation";

type MarketplaceFilter = "all" | SkillMarketplaceCollectionId;

const FILTER_LABELS: Record<MarketplaceFilter, string> = {
  claw3d: "VN AI Agent Office",
  all: "Tất cả",
  featured: "Nổi bật",
  installed: "Đã cài",
  "setup-required": "Cần thiết lập",
  "built-in": "Tích hợp sẵn",
  workspace: "Workspace",
  extra: "Cộng đồng",
  other: "Khác",
};

const READINESS_LABELS = {
  ready: "Sẵn sàng",
  "needs-setup": "Cần thiết lập",
  unavailable: "Không khả dụng",
  "disabled-globally": "Tắt toàn cục",
} as const;

const READINESS_CLASSES = {
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  "needs-setup": "border-amber-500/30 bg-amber-500/10 text-amber-100",
  unavailable: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  "disabled-globally": "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
} as const;

const formatRating = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "4.7";
  }
  return value.toFixed(1);
};

const formatInstalls = (value: number | undefined) => {
  const installs = value ?? 0;
  if (installs >= 1000) {
    return `${(installs / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat("en-US").format(installs);
};

const buildSearchBlob = (entry: SkillMarketplaceEntry): string => {
  return [
    entry.skill.name,
    entry.skill.description,
    entry.skill.skillKey,
    entry.skill.source,
    entry.metadata.category,
    entry.metadata.tagline,
    entry.metadata.capabilities.join(" "),
  ]
    .join(" ")
    .toLowerCase();
};

const getAgentSkillEnabled = (
  skillName: string,
  accessMode: ReturnType<typeof deriveAgentSkillsAccessMode>,
  allowlistSet: Set<string>
) => {
  if (accessMode === "all") {
    return true;
  }
  if (accessMode === "none") {
    return false;
  }
  return allowlistSet.has(skillName.trim());
};

export function SkillsMarketplacePanel({
  marketplace,
  onSelectAgent,
  onOpenAgentSettings,
}: {
  marketplace: OfficeSkillsMarketplaceController;
  onSelectAgent: (agentId: string) => void;
  onOpenAgentSettings: (agentId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<MarketplaceFilter>("claw3d");
  const [detailSkillKey, setDetailSkillKey] = useState<string | null>(null);

  const entries = useMemo(
    () => marketplace.marketplaceSkills ?? marketplace.skillsReport?.skills ?? [],
    [marketplace.marketplaceSkills, marketplace.skillsReport]
  );
  const collections = useMemo(() => buildSkillMarketplaceCollections(entries), [entries]);
  const accessMode = useMemo(
    () => deriveAgentSkillsAccessMode(marketplace.skillsAllowlist),
    [marketplace.skillsAllowlist]
  );
  const allowlistSet = useMemo(
    () => buildAgentSkillsAllowlistSet(marketplace.skillsAllowlist),
    [marketplace.skillsAllowlist]
  );

  const filteredCollections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const visibleCollectionIds: SkillMarketplaceCollectionId[] =
      activeFilter === "all"
        ? ["claw3d", "built-in", "installed", "workspace", "extra", "other"]
        : [activeFilter];
    return collections
      .filter((collection) => visibleCollectionIds.includes(collection.id))
      .map((collection) => ({
        ...collection,
        entries: collection.entries.filter((entry) => {
          if (!normalizedQuery) {
            return true;
          }
          return buildSearchBlob(entry).includes(normalizedQuery);
        }),
      }))
      .filter((collection) => collection.entries.length > 0);
  }, [activeFilter, collections, query]);

  const featuredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const featuredCollection = collections.find((collection) => collection.id === "featured");
    if (!featuredCollection) {
      return [];
    }
    return featuredCollection.entries
      .filter((entry) => {
        if (!normalizedQuery) {
          return true;
        }
        return buildSearchBlob(entry).includes(normalizedQuery);
      })
      .slice(0, 3);
  }, [collections, query]);

  const filterCounts = useMemo(() => {
    const counts: Record<MarketplaceFilter, number> = {
      claw3d: 0,
      all: entries.length,
      featured: 0,
      installed: 0,
      "setup-required": 0,
      "built-in": 0,
      workspace: 0,
      extra: 0,
      other: 0,
    };
    for (const collection of collections) {
      counts[collection.id] = collection.entries.length;
    }
    return counts;
  }, [collections, entries.length]);

  const detailEntry =
    collections
      .flatMap((collection) => collection.entries)
      .find((entry) => entry.skill.skillKey === detailSkillKey) ?? null;

  return (
    <section className="relative flex h-full min-h-0 flex-col">
      <div className="border-b border-cyan-500/10 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/70">
              Kho kỹ năng
            </div>
            <div className="mt-1 font-mono text-[11px] text-white/40">
              Duyệt kỹ năng cho cổng kết nối như một cửa hàng plugin.
            </div>
          </div>
          <button
            type="button"
            onClick={() => void marketplace.refresh()}
            className="inline-flex items-center gap-1 rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200 transition-colors hover:border-cyan-400/40 hover:text-cyan-100"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Làm mới
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 font-mono text-[10px] text-amber-100">
          Cài kỹ năng theo gói nhắm tới workspace của tác nhân đã chọn. Các thao tác thiết lập toàn cục vẫn ảnh hưởng toàn bộ cổng kết nối. Kiểm soát truy cập bên dưới chỉ áp dụng cho tác nhân đã chọn.
        </div>

        <div className="mt-3 rounded border border-cyan-500/15 bg-white/[0.03] px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                Ngữ cảnh tác nhân
              </div>
              <div className="mt-1 font-mono text-[11px] text-white/75">
                {marketplace.selectedAgent?.name ?? "Chưa chọn tác nhân"}
              </div>
            </div>
            <div className="font-mono text-[10px] text-white/35">
              Chế độ truy cập: {accessMode === "selected" ? "Kỹ năng được chọn" : accessMode}
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <select
              value={marketplace.selectedAgentId ?? ""}
              onChange={(event) => marketplace.setSelectedAgentId(event.target.value || null)}
              className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-2 font-mono text-[11px] text-white/80 outline-none"
            >
              {marketplace.agents.length === 0 ? <option value="">Chưa có tác nhân</option> : null}
              {marketplace.agents.map((agent) => (
                <option key={agent.agentId} value={agent.agentId}>
                  {agent.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!marketplace.selectedAgentId}
              onClick={() => {
                if (marketplace.selectedAgentId) {
                  onSelectAgent(marketplace.selectedAgentId);
                }
              }}
              className="rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/75 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mở chat
            </button>
            <button
              type="button"
              disabled={!marketplace.selectedAgentId}
              onClick={() => {
                if (marketplace.selectedAgentId) {
                  onOpenAgentSettings(marketplace.selectedAgentId);
                }
              }}
              className="rounded border border-white/10 bg-white/5 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/75 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cài đặt
            </button>
          </div>
        </div>

        <div className="mt-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm kỹ năng, danh mục, hoặc nguồn"
            className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px] text-white/85 outline-none transition focus:border-cyan-400/35"
            aria-label="Tìm kiếm kỹ năng marketplace"
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {(Object.keys(FILTER_LABELS) as MarketplaceFilter[]).map((filterId) => (
            <button
              key={filterId}
              type="button"
              onClick={() => setActiveFilter(filterId)}
              className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                activeFilter === filterId
                  ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-100"
                  : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white/80"
              }`}
            >
              {FILTER_LABELS[filterId]} ({filterCounts[filterId]})
            </button>
          ))}
        </div>

        {marketplace.message ? (
          <div
            className={`mt-3 rounded border px-3 py-2 font-mono text-[11px] ${
              marketplace.message.kind === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-rose-500/30 bg-rose-500/10 text-rose-100"
            }`}
          >
            {marketplace.message.text}
            {marketplace.message.kind === "success" ? (
              <div className="mt-1 font-mono text-[10px] text-emerald-100/80">
                Check the `CLAW3D` filter below to find the installed skill quickly.
              </div>
            ) : null}
          </div>
        ) : null}

        {marketplace.error && !marketplace.message ? (
          <div className="mt-3 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-mono text-[11px] text-rose-100">
            {marketplace.error}
          </div>
        ) : null}

        {marketplace.loading ? (
          <div className="mt-4 font-mono text-[11px] text-white/45">Đang tải kho kỹ năng...</div>
        ) : null}

        {!marketplace.loading && activeFilter === "all" && featuredEntries.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              Kỹ năng nổi bật
            </div>
            <div className="grid gap-2">
              {featuredEntries.map((entry) => (
                <button
                  key={`featured:${entry.skill.skillKey}`}
                  type="button"
                  onClick={() => setDetailSkillKey(entry.skill.skillKey)}
                  className="rounded border border-cyan-500/15 bg-gradient-to-br from-cyan-500/10 to-transparent px-3 py-3 text-left transition-colors hover:border-cyan-400/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-[11px] font-semibold text-white/90">{entry.skill.name}</div>
                      <div className="mt-1 font-mono text-[10px] text-cyan-100/75">{entry.metadata.tagline}</div>
                    </div>
                    <div className="rounded border border-cyan-500/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-100/85">
                      {entry.metadata.editorBadge ?? "Nổi bật"}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10px] text-white/55">
                    {!entry.metadata.hideStats ? (
                      <>
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-300" />
                          {formatRating(entry.metadata.rating)}
                        </span>
                        <span>{formatInstalls(entry.metadata.installs)} lượt cài</span>
                      </>
                    ) : null}
                    <span>{entry.metadata.category}</span>
                  </div>
                  {entry.metadata.poweredByName && entry.metadata.poweredByUrl ? (
                    <div className="mt-2 font-mono text-[10px] text-white/55">
                      Được cung cấp bởi{" "}
                      <a
                        href={entry.metadata.poweredByUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-200 underline decoration-cyan-500/40 underline-offset-2 transition-colors hover:text-cyan-100"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {entry.metadata.poweredByName}
                      </a>
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!marketplace.loading && filteredCollections.length === 0 ? (
          <div className="mt-4 rounded border border-white/10 bg-white/[0.03] px-3 py-4 font-mono text-[11px] text-white/45">
            Không tìm thấy kỹ năng phù hợp cho cổng kết nối này.
          </div>
        ) : null}

        {!marketplace.loading &&
          filteredCollections.map((collection) => (
            <div key={collection.id} className="mt-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                {collection.label}
              </div>
              <div className="flex flex-col gap-2">
                {collection.entries.map((entry) => {
                  const packagedSkill = marketplace.packagedSkillsByKey.get(entry.skill.skillKey);
                  const packageOnly = Boolean(packagedSkill && !entry.skill.baseDir.trim());
                  const isEnabledForAgent = getAgentSkillEnabled(entry.skill.name, accessMode, allowlistSet);
                  const primaryAction =
                    packageOnly
                      ? {
                          label: "Cài kỹ năng",
                          run: () => void marketplace.handleInstallPackagedSkill(entry.skill.skillKey),
                          icon: Download,
                        }
                      : entry.readiness === "needs-setup" && entry.installable
                      ? {
                          label: "Cài gói phụ thuộc",
                          run: () => void marketplace.handleInstallSkill(entry.skill),
                          icon: Download,
                        }
                      : entry.readiness === "disabled-globally"
                        ? {
                            label: "Bật cho cổng kết nối",
                            run: () => void marketplace.handleSetSkillGlobalEnabled(entry.skill.skillKey, true),
                            icon: Settings2,
                          }
                        : entry.readiness === "needs-setup"
                          ? {
                              label: "Mở cài đặt",
                              run: () => {
                                if (marketplace.selectedAgentId) {
                                  onOpenAgentSettings(marketplace.selectedAgentId);
                                }
                              },
                              icon: Settings2,
                            }
                          : null;
                  const PrimaryIcon = primaryAction?.icon ?? Settings2;
                  return (
                    <div
                      key={`${collection.id}:${entry.skill.skillKey}`}
                      className="rounded border border-white/8 bg-white/[0.03] px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailSkillKey(entry.skill.skillKey)}
                              className="truncate font-mono text-[11px] font-semibold text-white/90 transition-colors hover:text-cyan-100"
                            >
                              {entry.skill.name}
                            </button>
                            <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/45">
                              {entry.metadata.category}
                            </span>
                            <span
                              className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${READINESS_CLASSES[entry.readiness]}`}
                            >
                              {READINESS_LABELS[entry.readiness]}
                            </span>
                          </div>
                          <div className="mt-2 font-mono text-[10px] text-white/65">{entry.metadata.tagline}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[10px] text-white/45">
                            <span className="inline-flex items-center gap-1">
                              <Shield className="h-3 w-3 text-cyan-300" />
                              {entry.metadata.trustLabel}
                            </span>
                            {!entry.metadata.hideStats ? (
                              <>
                                <span className="inline-flex items-center gap-1">
                                  <Star className="h-3 w-3 text-amber-300" />
                                  {formatRating(entry.metadata.rating)}
                                </span>
                                <span>{formatInstalls(entry.metadata.installs)} lượt cài</span>
                              </>
                            ) : null}
                            <span>{entry.skill.source}</span>
                          </div>
                          {entry.metadata.poweredByName && entry.metadata.poweredByUrl ? (
                            <div className="mt-2 font-mono text-[10px] text-white/55">
                              Được cung cấp bởi{" "}
                              <a
                                href={entry.metadata.poweredByUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-200 underline decoration-cyan-500/40 underline-offset-2 transition-colors hover:text-cyan-100"
                              >
                                {entry.metadata.poweredByName}
                              </a>
                            </div>
                          ) : null}
                          {entry.missingDetails.length > 0 ? (
                            <div className="mt-2 font-mono text-[10px] text-amber-100/85">
                              {entry.missingDetails[0]}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() => void marketplace.handleSetSkillEnabled(entry.skill.name, !isEnabledForAgent)}
                            disabled={
                              packageOnly ||
                              entry.readiness === "unavailable" ||
                              !marketplace.selectedAgentId ||
                              marketplace.busySkillKey === entry.skill.skillKey
                            }
                            className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                              isEnabledForAgent
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                                : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                            }`}
                          >
                            {isEnabledForAgent ? "Tắt cho tác nhân" : "Bật cho tác nhân"}
                          </button>

                          <div className="flex flex-wrap justify-end gap-2">
                            {primaryAction ? (
                              <button
                                type="button"
                                onClick={primaryAction.run}
                                disabled={
                                  marketplace.busySkillKey === entry.skill.skillKey ||
                                  (packageOnly && !marketplace.selectedAgentId) ||
                                  (primaryAction.label === "Open settings" &&
                                    !marketplace.selectedAgentId)
                                }
                                className="inline-flex items-center gap-1 rounded border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <PrimaryIcon className="h-3.5 w-3.5" />
                                {primaryAction.label}
                              </button>
                            ) : null}

                            {entry.removable ? (
                              <button
                                type="button"
                                onClick={() => void marketplace.handleRemoveSkill(entry.skill)}
                                disabled={marketplace.busySkillKey === entry.skill.skillKey}
                                className="inline-flex items-center gap-1 rounded border border-rose-500/25 bg-rose-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-rose-100 transition-colors hover:border-rose-400/40 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Xoá cho tất cả tác nhân
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => setDetailSkillKey(entry.skill.skillKey)}
                              className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/75 transition-colors hover:bg-white/10"
                            >
                              Chi tiết
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-white/35">
                        <div>
                          {isEnabledForAgent
                            ? "Kỹ năng này đang bật cho tác nhân đã chọn."
                            : "Kỹ năng này đang tắt cho tác nhân đã chọn."}
                        </div>
                        {entry.removable ? (
                          <div>Xoá khỏi cổng kết nối sẽ xoá kỹ năng đã cài cho tất cả tác nhân.</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>

      {detailEntry ? (
        <div className="absolute inset-0 z-10 flex flex-col bg-[#050607]/96">
          <div className="flex items-start justify-between border-b border-cyan-500/10 px-4 py-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                Chi tiết kỹ năng
              </div>
              <div className="mt-1 font-mono text-[14px] font-semibold text-white/90">
                {detailEntry.skill.name}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDetailSkillKey(null)}
              className="rounded border border-white/10 bg-white/5 p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Đóng chi tiết marketplace"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="rounded border border-white/8 bg-white/[0.03] px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-cyan-100">
                  {detailEntry.metadata.category}
                </span>
                <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">
                  {detailEntry.metadata.trustLabel}
                </span>
                <span
                  className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${READINESS_CLASSES[detailEntry.readiness]}`}
                >
                  {READINESS_LABELS[detailEntry.readiness]}
                </span>
              </div>
              <div className="mt-3 font-mono text-[11px] text-white/75">{detailEntry.metadata.tagline}</div>
              {detailEntry.metadata.poweredByName && detailEntry.metadata.poweredByUrl ? (
                <div className="mt-3 font-mono text-[10px] text-white/60">
                  Được cung cấp bởi{" "}
                  <a
                    href={detailEntry.metadata.poweredByUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-200 underline decoration-cyan-500/40 underline-offset-2 transition-colors hover:text-cyan-100"
                  >
                    {detailEntry.metadata.poweredByName}
                  </a>
                </div>
              ) : null}
              <div
                className={`mt-3 grid gap-2 font-mono text-[10px] text-white/55 ${
                  detailEntry.metadata.hideStats ? "grid-cols-1" : "grid-cols-3"
                }`}
              >
                {!detailEntry.metadata.hideStats ? (
                  <>
                    <div className="rounded border border-white/8 bg-black/30 px-2 py-2">
                      <div className="text-white/35">Đánh giá</div>
                      <div className="mt-1 text-white/90">{formatRating(detailEntry.metadata.rating)}</div>
                    </div>
                    <div className="rounded border border-white/8 bg-black/30 px-2 py-2">
                      <div className="text-white/35">Lượt cài</div>
                      <div className="mt-1 text-white/90">{formatInstalls(detailEntry.metadata.installs)}</div>
                    </div>
                  </>
                ) : null}
                <div className="rounded border border-white/8 bg-black/30 px-2 py-2">
                  <div className="text-white/35">Nguồn</div>
                  <div className="mt-1 text-white/90">{detailEntry.skill.source}</div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                Tính năng
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {detailEntry.metadata.capabilities.map((capability) => (
                  <div
                    key={capability}
                    className="rounded border border-white/8 bg-white/[0.03] px-3 py-2 font-mono text-[10px] text-white/70"
                  >
                    {capability}
                  </div>
                ))}
              </div>
            </div>

            {detailEntry.missingDetails.length > 0 ? (
              <div className="mt-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                  Ghi chú thiết lập
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {detailEntry.missingDetails.map((line) => (
                    <div
                      key={line}
                      className="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2 font-mono text-[10px] text-amber-100"
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded border border-cyan-500/15 bg-cyan-500/10 px-3 py-3 font-mono text-[10px] text-cyan-100">
              Cài gói sẽ nằm trong workspace đã chọn. Thay đổi thiết lập cổng kết nối vẫn áp dụng cho mọi tác nhân, và việc bật/tắt tác nhân phụ thuộc vào danh sách cho phép của tác nhân đó.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {marketplace.packagedSkillsByKey.get(detailEntry.skill.skillKey) &&
              !detailEntry.skill.baseDir.trim() ? (
                <button
                  type="button"
                  onClick={() => void marketplace.handleInstallPackagedSkill(detailEntry.skill.skillKey)}
                  disabled={marketplace.busySkillKey === detailEntry.skill.skillKey}
                  className="inline-flex items-center gap-1 rounded border border-cyan-500/25 bg-cyan-500/10 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Download className="h-3.5 w-3.5" />
                  Cài kỹ năng
                </button>
              ) : null}
              {detailEntry.readiness === "needs-setup" && detailEntry.installable ? (
                <button
                  type="button"
                  onClick={() => void marketplace.handleInstallSkill(detailEntry.skill)}
                  disabled={marketplace.busySkillKey === detailEntry.skill.skillKey}
                  className="inline-flex items-center gap-1 rounded border border-cyan-500/25 bg-cyan-500/10 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Download className="h-3.5 w-3.5" />
                  Cài gói phụ thuộc
                </button>
              ) : null}
              {detailEntry.readiness === "disabled-globally" ? (
                <button
                  type="button"
                  onClick={() =>
                    void marketplace.handleSetSkillGlobalEnabled(detailEntry.skill.skillKey, true)
                  }
                  disabled={marketplace.busySkillKey === detailEntry.skill.skillKey}
                  className="inline-flex items-center gap-1 rounded border border-cyan-500/25 bg-cyan-500/10 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:border-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Bật cho cổng kết nối
                </button>
              ) : null}
              <button
                type="button"
                disabled={!marketplace.selectedAgentId}
                onClick={() => {
                  if (marketplace.selectedAgentId) {
                    onOpenAgentSettings(marketplace.selectedAgentId);
                  }
                }}
                className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/75 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Quản lý trong cài đặt
              </button>
              {detailEntry.skill.homepage ? (
                <a
                  href={detailEntry.skill.homepage}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/75 transition-colors hover:bg-white/10"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Trang chủ
                </a>
              ) : null}
            </div>
            <div className="mt-4 rounded border border-white/8 bg-white/[0.03] px-3 py-3 font-mono text-[10px] text-white/60">
              `Bật/Tắt cho tác nhân` chỉ thay đổi quyền truy cập cho tác nhân đã chọn. `Xoá cho tất cả tác nhân` sẽ xoá kỹ năng đã cài khỏi workspace của cổng kết nối.
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
