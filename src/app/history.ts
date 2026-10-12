// Recent plans, kept in this browser only.
import type { PlanRecord } from "../plan/plan";

const KEY = "apex.plans.v1";
const LIMIT = 20;

export function loadPlans(): PlanRecord[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function store(list: PlanRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
  } catch {
    // Storage full or blocked: the plan is still shown, just not remembered.
  }
}

export function savePlan(record: PlanRecord): PlanRecord[] {
  const list = [record, ...loadPlans().filter((p) => p.id !== record.id)];
  store(list);
  return list.slice(0, LIMIT);
}

export function deletePlan(id: string): PlanRecord[] {
  const list = loadPlans().filter((p) => p.id !== id);
  store(list);
  return list;
}
