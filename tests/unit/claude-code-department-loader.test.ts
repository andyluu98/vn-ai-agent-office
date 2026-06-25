// tests/unit/claude-code-department-loader.test.ts
// TDD tests for department-loader.js (L1.1) and registry seed-not-capped (L1.3).
import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// CJS interop
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loaderMod = require("../../server/claude-code-adapter/department-loader");
const parseAgentMarkdown: (text: string) => {
  id?: string;
  name?: string;
  emoji?: string;
  department?: string;
  system?: string;
} | null = loaderMod.parseAgentMarkdown;
const parseDepartmentYaml: (text: string) => { code?: string; nameVn?: string } = loaderMod.parseDepartmentYaml;
const loadDepartmentRoster: (dir: string) => Array<{
  id: string;
  name: string;
  role: string;
  emoji: string;
  system: string;
  department: string;
  departmentName: string;
}> | null = loaderMod.loadDepartmentRoster;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const registryMod = require("../../server/claude-code-adapter/agent-registry");
const createRegistry: (opts: {
  seed: unknown[];
  maxAgents?: number;
  ttlMs?: number;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) => any = registryMod.default ?? registryMod.createRegistry ?? registryMod;

// ---------------------------------------------------------------------------
// Inline fixtures
// ---------------------------------------------------------------------------

const AGENT_WITH_VAI_TRO = `---
id: legal-officer
name_vn: Cán bộ Pháp chế
department: 01-governance
emoji: ⚖️
expertise:
- Luật Doanh nghiệp 2020
temperature: 0.3
---

# ⚖️ Cán bộ Pháp chế

## Vai trò
Bạn là Cán bộ Pháp chế với 8+ năm kinh nghiệm tư vấn pháp lý doanh nghiệp tại Việt Nam.

## Chuyên môn
- Luật DN 2020: cơ cấu vốn góp
- BLLĐ 2019: HĐLĐ xác định

## Anti-patterns
- Không làm điều xấu
`;

const AGENT_NO_VAI_TRO = `---
id: brand-manager
name_vn: Quản lý Thương hiệu
department: 07-marketing
emoji: 🎨
---

Bạn là người quản lý thương hiệu của công ty.
Chịu trách nhiệm về nhận diện thương hiệu.
`;

const AGENT_NO_FRONTMATTER = `# Just a markdown file

No frontmatter here.
`;

const AGENT_NO_ID = `---
name_vn: Agent Without ID
department: 01-governance
---

## Vai trò
Some role.
`;

const DEPT_YAML_01 = `code: 01-governance
name_vn: Quản trị & Pháp lý
tier: 1
description: Phòng Quản trị & Pháp lý.
agents:
- legal-officer
- compliance-checker
default_speaker: legal-officer
`;

const DEPT_YAML_07 = `code: 07-marketing
name_vn: Marketing & Thương hiệu
tier: 3
`;

// ---------------------------------------------------------------------------
// parseAgentMarkdown
// ---------------------------------------------------------------------------

describe("parseAgentMarkdown", () => {
  it("extracts id, name, emoji, department from frontmatter", () => {
    const result = parseAgentMarkdown(AGENT_WITH_VAI_TRO);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("legal-officer");
    expect(result!.name).toBe("Cán bộ Pháp chế");
    expect(result!.emoji).toBe("⚖️");
    expect(result!.department).toBe("01-governance");
  });

  it("system = text under ## Vai trò up to next ## heading", () => {
    const result = parseAgentMarkdown(AGENT_WITH_VAI_TRO);
    expect(result).not.toBeNull();
    // Must include the Vai trò paragraph
    expect(result!.system).toContain("Bạn là Cán bộ Pháp chế với 8+ năm kinh nghiệm");
    // Must NOT include the next section heading content like "Luật DN 2020: cơ cấu vốn góp"
    // (that's under ## Chuyên môn, not ## Vai trò)
    expect(result!.system).not.toContain("Luật DN 2020: cơ cấu vốn góp");
    // Must not include Anti-patterns section
    expect(result!.system).not.toContain("Anti-patterns");
  });

  it("system falls back to full body when no ## Vai trò heading", () => {
    const result = parseAgentMarkdown(AGENT_NO_VAI_TRO);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("brand-manager");
    // system should be the body text (no ## Vai trò heading in this fixture)
    expect(result!.system).toContain("Bạn là người quản lý thương hiệu");
  });

  it("returns null when no frontmatter delimiters", () => {
    expect(parseAgentMarkdown(AGENT_NO_FRONTMATTER)).toBeNull();
  });

  it("returns null when frontmatter has no id", () => {
    expect(parseAgentMarkdown(AGENT_NO_ID)).toBeNull();
  });

  it("returns null for non-string input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseAgentMarkdown(null as any)).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseAgentMarkdown(undefined as any)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseDepartmentYaml
// ---------------------------------------------------------------------------

describe("parseDepartmentYaml", () => {
  it("extracts code and nameVn scalar fields", () => {
    const result = parseDepartmentYaml(DEPT_YAML_01);
    expect(result.code).toBe("01-governance");
    expect(result.nameVn).toBe("Quản trị & Pháp lý");
  });

  it("handles dept with name_vn containing &", () => {
    const result = parseDepartmentYaml(DEPT_YAML_07);
    expect(result.code).toBe("07-marketing");
    expect(result.nameVn).toBe("Marketing & Thương hiệu");
  });

  it("ignores list values and nested keys", () => {
    const result = parseDepartmentYaml(DEPT_YAML_01);
    // 'agents' list items (e.g. "- legal-officer") must not bleed into code/nameVn
    expect(result.code).toBe("01-governance");
    expect(result.nameVn).toBe("Quản trị & Pháp lý");
    // No list-item values like "legal-officer" should appear as code or nameVn
    expect(result.code).not.toBe("legal-officer");
    expect(result.nameVn).not.toBe("legal-officer");
  });

  it("returns empty object for empty string", () => {
    expect(parseDepartmentYaml("")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// loadDepartmentRoster — uses temp directories
// ---------------------------------------------------------------------------

// Track temp dirs to clean up
const tmpDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dept-loader-test-"));
  tmpDirs.push(dir);
  return dir;
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

afterEach(() => {
  // Clean up temp directories
  for (const dir of tmpDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
});

describe("loadDepartmentRoster", () => {
  it("returns null for a missing directory", () => {
    expect(loadDepartmentRoster("/nonexistent/path/that/does/not/exist")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(loadDepartmentRoster("")).toBeNull();
  });

  it("loads 4 agents from 2 departments × 2 agents each", () => {
    const root = makeTempDir();

    // Dept 01
    writeFile(path.join(root, "01-governance", "department.yaml"), DEPT_YAML_01);
    writeFile(
      path.join(root, "01-governance", "agents", "legal-officer.md"),
      AGENT_WITH_VAI_TRO,
    );
    writeFile(
      path.join(root, "01-governance", "agents", "compliance-checker.md"),
      `---
id: compliance-checker
name_vn: Cán bộ Tuân thủ
department: 01-governance
emoji: 🔍
---

## Vai trò
Bạn là Cán bộ Tuân thủ.
`,
    );

    // Dept 07
    writeFile(path.join(root, "07-marketing", "department.yaml"), DEPT_YAML_07);
    writeFile(
      path.join(root, "07-marketing", "agents", "brand-manager.md"),
      AGENT_NO_VAI_TRO,
    );
    writeFile(
      path.join(root, "07-marketing", "agents", "content-creator.md"),
      `---
id: content-creator
name_vn: Người Tạo Nội Dung
department: 07-marketing
emoji: ✍️
---

## Vai trò
Bạn là Người Tạo Nội Dung.
`,
    );

    const agents = loadDepartmentRoster(root);
    expect(agents).not.toBeNull();
    expect(agents!).toHaveLength(4);
  });

  it("agents have correct name, role, department, departmentName fields", () => {
    const root = makeTempDir();
    writeFile(path.join(root, "01-governance", "department.yaml"), DEPT_YAML_01);
    writeFile(path.join(root, "01-governance", "agents", "legal-officer.md"), AGENT_WITH_VAI_TRO);

    const agents = loadDepartmentRoster(root);
    expect(agents).not.toBeNull();
    const agent = agents![0];
    expect(agent.name).toBe("Cán bộ Pháp chế");
    expect(agent.role).toBe("Cán bộ Pháp chế"); // unique — no collision
    expect(agent.department).toBe("01-governance");
    expect(agent.departmentName).toBe("Quản trị & Pháp lý");
    expect(agent.emoji).toBe("⚖️");
    expect(agent.system).toContain("Bạn là Cán bộ Pháp chế với 8+ năm kinh nghiệm");
  });

  it("role uniqueness: duplicate name_vn gets dept suffix", () => {
    const root = makeTempDir();

    // Two different depts with agents sharing the same name_vn
    writeFile(path.join(root, "01-governance", "department.yaml"), DEPT_YAML_01);
    writeFile(
      path.join(root, "01-governance", "agents", "agent-a.md"),
      `---
id: agent-a
name_vn: Chuyên Viên
department: 01-governance
---

## Vai trò
Agent A role.
`,
    );

    writeFile(path.join(root, "07-marketing", "department.yaml"), DEPT_YAML_07);
    writeFile(
      path.join(root, "07-marketing", "agents", "agent-b.md"),
      `---
id: agent-b
name_vn: Chuyên Viên
department: 07-marketing
---

## Vai trò
Agent B role.
`,
    );

    const agents = loadDepartmentRoster(root);
    expect(agents).not.toBeNull();
    expect(agents!).toHaveLength(2);

    const roles = agents!.map((a) => a.role);
    // One should be the plain name, other should have a dept suffix
    expect(roles).toContain("Chuyên Viên");
    const suffixed = roles.find((r) => r !== "Chuyên Viên");
    expect(suffixed).toBeDefined();
    expect(suffixed).toContain("Chuyên Viên");
    expect(suffixed).toContain("·");
    // All roles must be unique
    expect(new Set(roles).size).toBe(2);
  });

  it("returns null when no departments have an agents/ folder", () => {
    const root = makeTempDir();
    // Create a subdir with no agents/ folder
    fs.mkdirSync(path.join(root, "01-governance"));
    writeFile(path.join(root, "01-governance", "department.yaml"), DEPT_YAML_01);
    expect(loadDepartmentRoster(root)).toBeNull();
  });

  it("skips the _base folder (no agents) without erroring", () => {
    const root = makeTempDir();
    // _base has no agents/ folder
    fs.mkdirSync(path.join(root, "_base"));

    writeFile(path.join(root, "01-governance", "department.yaml"), DEPT_YAML_01);
    writeFile(path.join(root, "01-governance", "agents", "legal-officer.md"), AGENT_WITH_VAI_TRO);

    const agents = loadDepartmentRoster(root);
    expect(agents).not.toBeNull();
    expect(agents!).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// L1.3 — registry seed-not-capped
// ---------------------------------------------------------------------------

describe("createRegistry seed-not-capped (L1.3)", () => {
  it("loads all 20 seed agents even when maxAgents is 12", () => {
    const seeds = Array.from({ length: 20 }, (_, i) => ({
      id: `seed-${i}`,
      name: `Agent ${i}`,
      role: `Agent ${i}`,
      emoji: "🤖",
      system: `You are Agent ${i}.`,
    }));

    const reg = createRegistry({ seed: seeds, maxAgents: 12 });
    expect(reg.list()).toHaveLength(20);
    // All must be marked seed:true
    expect(reg.list().every((a: { seed: boolean }) => a.seed === true)).toBe(true);
  });

  it("after loading 20 seeds with maxAgents 12, add() returns cap", () => {
    const seeds = Array.from({ length: 20 }, (_, i) => ({
      id: `seed-${i}`,
      name: `Agent ${i}`,
      role: `Agent ${i}`,
    }));

    const reg = createRegistry({ seed: seeds, maxAgents: 12 });
    // add() checks agents.length >= maxAgents → 20 >= 12 → cap
    const result = reg.add({ name: "Extra", role: "Extra" }, Date.now());
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("cap");
    // Still 20
    expect(reg.list()).toHaveLength(20);
  });

  it("with 3 seeds and maxAgents 12, add() succeeds up to 12 total", () => {
    const seeds = [
      { id: "s1", name: "Seed1", role: "Seed1" },
      { id: "s2", name: "Seed2", role: "Seed2" },
      { id: "s3", name: "Seed3", role: "Seed3" },
    ];

    const reg = createRegistry({ seed: seeds, maxAgents: 12 });
    expect(reg.list()).toHaveLength(3);
    // Can add 9 more (3 + 9 = 12)
    for (let i = 4; i <= 12; i++) {
      const r = reg.add({ name: `Runtime${i}`, role: `Runtime${i}` }, Date.now());
      expect(r.ok).toBe(true);
    }
    expect(reg.list()).toHaveLength(12);
    // 13th add hits cap
    const over = reg.add({ name: "Over", role: "Over" }, Date.now());
    expect(over.ok).toBe(false);
    expect(over.reason).toBe("cap");
  });
});
