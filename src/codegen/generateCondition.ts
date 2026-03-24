import type { Condition } from "../types";

export function generateCondition(condition: Condition): string {
  return `${condition.variable} ${condition.operator} ${condition.value}`;
}
