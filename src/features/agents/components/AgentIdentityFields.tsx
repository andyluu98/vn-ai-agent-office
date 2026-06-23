"use client";

export type AgentIdentityValues = {
  name: string;
  creature: string;
  vibe: string;
  emoji: string;
};

type AgentIdentityFieldsProps = {
  values: AgentIdentityValues;
  disabled?: boolean;
  onChange: (field: keyof AgentIdentityValues, value: string) => void;
};

const inputClassName =
  "h-10 rounded-md border border-border/80 bg-background px-3 text-sm text-foreground outline-none";

export function AgentIdentityFields({
  values,
  disabled = false,
  onChange,
}: AgentIdentityFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-2 text-xs text-muted-foreground">
        Tên
        <input
          className={inputClassName}
          value={values.name}
          placeholder="vd: Luke"
          disabled={disabled}
          onChange={(event) => {
            onChange("name", event.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-2 text-xs text-muted-foreground">
        Vai trò
        <input
          className={inputClassName}
          value={values.creature}
          placeholder="vd: Nhà thiết kế sản phẩm"
          disabled={disabled}
          onChange={(event) => {
            onChange("creature", event.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-2 text-xs text-muted-foreground">
        Phong cách
        <input
          className={inputClassName}
          value={values.vibe}
          placeholder="vd: Bình tĩnh, sắc bén và hữu ích"
          disabled={disabled}
          onChange={(event) => {
            onChange("vibe", event.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-2 text-xs text-muted-foreground">
        Emoji
        <input
          className={inputClassName}
          value={values.emoji}
          placeholder="vd: ✨"
          disabled={disabled}
          onChange={(event) => {
            onChange("emoji", event.target.value);
          }}
        />
      </label>
    </div>
  );
}
