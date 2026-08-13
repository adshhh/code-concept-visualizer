import { Chip } from "./Chip";
import type { Emphasis } from "../spotlight";

/** Not one of §5's 8 named shapes, but Python's `None` is unavoidable in real programs
 * (uninitialized variables, a function with no explicit `return`) — a pragmatic 9th shape,
 * decided independently and noted in the checkpoint rather than silently added. */
export function NoneChip({
  name,
  emphasis,
}: {
  name: string;
  emphasis: Emphasis;
}) {
  return (
    <Chip name={name} emphasis={emphasis} accent="text-slate-500 italic">
      None
    </Chip>
  );
}
