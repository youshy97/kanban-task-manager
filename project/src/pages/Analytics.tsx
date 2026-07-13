import { useMemo } from 'react';
import { BarChart3, PieChart, TrendingUp, Users } from 'lucide-react';
import type { Task, Profile } from '../lib/types';
import { COLUMNS, PRIORITIES } from '../lib/constants';
import { isOverdue } from '../lib/format';

export function Analytics({ tasks, profiles }: { tasks: Task[]; profiles: Profile[] }) {
  const statusDist = useMemo(() => {
    return COLUMNS.map((c) => ({ ...c, count: tasks.filter((t) => t.status === c.id).length }));
  }, [tasks]);

  const priorityDist = useMemo(() => {
    return PRIORITIES.map((p) => ({ ...p, count: tasks.filter((t) => t.priority === p.id).length }));
  }, [tasks]);

  const employeeWorkload = useMemo(() => {
    return profiles.map((p) => ({
      profile: p,
      active: tasks.filter((t) => t.assigned_to === p.id && t.status !== 'completed' && t.status !== 'cancelled').length,
      completed: tasks.filter((t) => t.assigned_to === p.id && t.status === 'completed').length,
    })).sort((a, b) => b.active + b.completed - a.active - a.completed);
  }, [tasks, profiles]);

  const maxStatus = Math.max(...statusDist.map((s) => s.count), 1);
  const maxWorkload = Math.max(...employeeWorkload.map((e) => e.active + e.completed), 1);

  const total = tasks.length;
  const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status)).length;
  const completionRate = total > 0 ? Math.round((tasks.filter((t) => t.status === 'completed').length / total) * 100) : 0;

  const barColors: Record<string, string> = {
    slate: 'bg-slate-400', blue: 'bg-blue-400', amber: 'bg-amber-400', violet: 'bg-violet-400',
    rose: 'bg-rose-400', emerald: 'bg-emerald-400', zinc: 'bg-zinc-400',
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Insights into your team's performance.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-3xl font-bold text-slate-900">{total}</p>
          <p className="text-sm text-slate-500 mt-1">Total Tasks</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-3xl font-bold text-red-600">{overdue}</p>
          <p className="text-sm text-slate-500 mt-1">Overdue</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-3xl font-bold text-emerald-600">{completionRate}%</p>
          <p className="text-sm text-slate-500 mt-1">Completion Rate</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-3xl font-bold text-blue-600">{profiles.length}</p>
          <p className="text-sm text-slate-500 mt-1">Team Members</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-5">
            <BarChart3 className="w-5 h-5 text-blue-600" /> Tasks by Status
          </h2>
          <div className="space-y-3">
            {statusDist.map((s) => (
              <div key={s.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600 font-medium">{s.label}</span>
                  <span className="text-slate-400">{s.count}</span>
                </div>
                <div className="h-6 bg-slate-100 rounded-lg overflow-hidden">
                  <div className={`h-full ${barColors[s.color]} rounded-lg transition-all duration-700 flex items-center justify-end pr-2`} style={{ width: `${(s.count / maxStatus) * 100}%`, minWidth: s.count > 0 ? '1.5rem' : '0' }}>
                    {s.count > 0 && <span className="text-xs text-white font-medium">{s.count}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority donut-like chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-5">
            <PieChart className="w-5 h-5 text-blue-600" /> Tasks by Priority
          </h2>
          <div className="flex items-center justify-center mb-4">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {(() => {
                  let offset = 0;
                  return priorityDist.map((p) => {
                    if (p.count === 0) return null;
                    const pct = (p.count / total) * 100;
                    const dash = (pct / 100) * 251.2;
                    const colors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
                    const circle = (
                      <circle
                        key={p.id}
                        cx="50" cy="50" r="40"
                        fill="none"
                        stroke={colors[p.id]}
                        strokeWidth="12"
                        strokeDasharray={`${dash} 251.2`}
                        strokeDashoffset={-offset}
                      />
                    );
                    offset += dash;
                    return circle;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-slate-900">{total}</span>
                <span className="text-xs text-slate-400">Total</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {priorityDist.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className={`w-3 h-3 rounded-full ${p.dot}`} />
                <span className="text-slate-600">{p.label}</span>
                <span className="text-slate-400 ml-auto">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Employee workload */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-5">
          <Users className="w-5 h-5 text-blue-600" /> Employee Workload
        </h2>
        {employeeWorkload.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">No team members</p>
        ) : (
          <div className="space-y-3">
            {employeeWorkload.map((e) => (
              <div key={e.profile.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-700 font-medium">{e.profile.full_name}</span>
                  <span className="text-slate-400 text-xs">{e.active} active · {e.completed} completed</span>
                </div>
                <div className="flex h-4 rounded overflow-hidden bg-slate-100">
                  <div className="bg-blue-500 transition-all duration-700" style={{ width: `${(e.active / maxWorkload) * 100}%` }} />
                  <div className="bg-emerald-400 transition-all duration-700" style={{ width: `${(e.completed / maxWorkload) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trend */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-5">
          <TrendingUp className="w-5 h-5 text-blue-600" /> Task Trend
        </h2>
        <div className="flex items-end justify-between gap-2 h-40">
          {Array.from({ length: 14 }).map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (13 - i));
            const dayStr = date.toISOString().slice(0, 10);
            const count = tasks.filter((t) => t.created_at.slice(0, 10) === dayStr).length;
            const maxDaily = Math.max(tasks.filter((t) => {
              const d = new Date();
              d.setDate(d.getDate() - 13);
              return t.created_at >= d.toISOString();
            }).length, 1);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-blue-500 rounded-t transition-all duration-500 hover:bg-blue-600" style={{ height: `${(count / maxDaily) * 100}%`, minHeight: count > 0 ? '4px' : '0' }} title={`${count} tasks`} />
                <span className="text-[9px] text-slate-400">{date.getDate()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
