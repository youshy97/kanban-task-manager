import { format, formatDistanceToNow } from 'date-fns';
import type { Priority, Role, TaskStatus } from './types';

export function fmtDate(d: string | null): string {
  if (!d) return '—';
  return format(new Date(d), 'MMM d, yyyy');
}

export function fmtDateTime(d: string | null): string {
  if (!d) return '—';
  return format(new Date(d), 'MMM d, yyyy HH:mm');
}

export function timeAgo(d: string): string {
  return formatDistanceToNow(new Date(d), { addSuffix: true });
}

export function isOverdue(due: string | null, status: TaskStatus): boolean {
  if (!due) return false;
  if (status === 'completed' || status === 'cancelled') return false;
  return new Date(due) < new Date();
}

export function priorityRank(p: Priority): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[p];
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function avatarColor(seed: string): string {
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-cyan-500', 'bg-orange-500'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function roleBadgeClass(role: Role): string {
  const map: Record<Role, string> = {
    super_admin: 'bg-red-100 text-red-700 border-red-200',
    admin: 'bg-orange-100 text-orange-700 border-orange-200',
    manager: 'bg-blue-100 text-blue-700 border-blue-200',
    employee: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    viewer: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return map[role];
}
