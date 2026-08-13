import { Chip } from "./Chip";
import type { Emphasis } from "../spotlight";

/** "Chip, colour-coded, plus a ✓/✗ glyph — never colour alone" (§5, and AC-10's
 * concrete instance of it: the glyph carries the meaning on its own, colour is a bonus). */
export function BooleanChip({
  name,
  value,
  emphasis,
}: {
  name: string;
  value: boolean;
  emphasis: Emphasis;
}) {
  return (
    <Chip
      name={name}
      emphasis={emphasis}
      accent={value ? "text-emerald-400" : "text-red-400"}
    >
      <span aria-hidden="true">{value ? "✓" : "✗"}</span>
      <span className="ml-1 text-sm text-slate-400">
        {value ? "True" : "False"}
      </span>
    </Chip>
  );
}
