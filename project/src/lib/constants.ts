import type { Priority, Role, TaskStatus } from './types';

export const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'slate' },
  { id: 'todo', label: 'To Do', color: 'blue' },
  { id: 'in_progress', label: 'In Progress', color: 'amber' },
  { id: 'review', label: 'Review', color: 'violet' },
  { id: 'blocked', label: 'Blocked', color: 'rose' },
  { id: 'completed', label: 'Completed', color: 'emerald' },
  { id: 'cancelled', label: 'Cancelled', color: 'zinc' },
];

export const PRIORITIES: {
  id: Priority;
  label: string;
  dot: string;
  text: string;
  bg: string;
  border: string;
}[] = [
  { id: 'critical', label: 'Critical', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  { id: 'high', label: 'High', dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  { id: 'medium', label: 'Medium', dot: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { id: 'low', label: 'Low', dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
];

export const ROLES: { id: Role; label: string }[] = [
  { id: 'super_admin', label: 'Super Admin' },
  { id: 'admin', label: 'Admin' },
  { id: 'manager', label: 'Manager' },
  { id: 'employee', label: 'Employee' },
  { id: 'viewer', label: 'Viewer' },
];

export const COLUMN_COLORS: Record<string, { header: string; bar: string }> = {
  slate: { header: 'text-slate-600', bar: 'bg-slate-400' },
  blue: { header: 'text-blue-600', bar: 'bg-blue-400' },
  amber: { header: 'text-amber-600', bar: 'bg-amber-400' },
  violet: { header: 'text-violet-600', bar: 'bg-violet-400' },
  rose: { header: 'text-rose-600', bar: 'bg-rose-400' },
  emerald: { header: 'text-emerald-600', bar: 'bg-emerald-400' },
  zinc: { header: 'text-zinc-600', bar: 'bg-zinc-400' },
};

export function priorityMeta(p: Priority) {
  return PRIORITIES.find((x) => x.id === p)!;
}

export function columnMeta(s: TaskStatus) {
  return COLUMNS.find((x) => x.id === s)!;
}

export function roleLabel(r: Role) {
  return ROLES.find((x) => x.id === r)?.label ?? r;
}
