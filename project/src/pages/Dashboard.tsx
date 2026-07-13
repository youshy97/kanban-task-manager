import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckSquare, AlertCircle, Clock, CheckCircle, Ban, ListTodo, TrendingUp, ArrowRight,
} from 'lucide-react';
import type { Task, Profile } from '../lib/types';
import { useAuth } from '../lib/auth';
import { isOverdue, timeAgo, fmtDate } from '../lib/format';
import { COLUMNS, priorityMeta, columnMeta } from '../lib/constants';
import { Avatar } from '../components/ui';

export function Dashboard({ tasks, profiles }: { tasks: Task[]; profiles: Profile[] }) {
  const { profile } = useAuth();

  const stats = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status)).length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const blocked = tasks.filter((t) => t.status === 'blocked').length;
    return { total, overdue, completed, inProgress, blocked };
  }, [tasks]);

  const myTasks = useMemo(() => {
    if (!profile) return [];
    return tasks.filter((t) => t.assigned_to === profile.id && t.status !== 'completed' && t.status !== 'cancelled').slice(0, 5);
  }, [tasks, profile]);

  const recentActivity = useMemo(() => {
    return [...tasks].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5);
  }, [tasks]);

  const statusDist = useMemo(() => {
    const dist: Record<string, number> = {};
    COLUMNS.forEach((c) => { dist[c.id] = tasks.filter((t) => t.status === c.id).length; });
    return dist;
  }, [tasks]);

  const cards = [
    { label: 'Total Tasks', value: stats.total, icon: ListTodo, color: 'blue' },
    { label: 'Overdue', value: stats.overdue, icon: AlertCircle, color: 'red' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'emerald' },
    { label: 'In Progress', value: stats.inProgress, icon: Clock, color: 'amber' },
    { label: 'Blocked', value: stats.blocked, icon: Ban, color: 'rose' },
  ];

  const textMap: Record<string, string> = {
    blue: 'text-blue-600', red: 'text-red-600', emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600',
  };
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-50', red: 'bg-red-50', emerald: 'bg-emerald-50', amber: 'bg-amber-50', rose: 'bg-rose-50',
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome back, {profile?.full_name.split(' ')[0]}</h1>
        <p className="text-slate-500 text-sm mt-1">Here's your project overview for today.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-lg ${bgMap[c.color]} flex items-center justify-center`}>
                <c.icon className={`w-5 h-5 ${textMap[c.color]}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Tasks */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-600" /> My Tasks
            </h2>
            <Link to="/app/board" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View Board <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {myTasks.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">No active tasks assigned to you</p>
          ) : (
            <div className="space-y-2">
              {myTasks.map((t) => {
                const pm = priorityMeta(t.priority);
                return (
                  <Link key={t.id} to="/app/board" className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <span className={`w-2 h-2 rounded-full ${pm.dot === 'bg-red-500' ? 'bg-red-500' : pm.dot === 'bg-orange-500' ? 'bg-orange-500' : pm.dot === 'bg-yellow-500' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                      <p className="text-xs text-slate-400">{columnMeta(t.status).label} · Due {fmtDate(t.due_date)}</p>
                    </div>
                    {isOverdue(t.due_date, t.status) && <AlertCircle className="w-4 h-4 text-red-500" />}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Status distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-blue-600" /> Task Distribution
          </h2>
          <div className="space-y-3">
            {COLUMNS.map((col) => {
              const count = statusDist[col.id];
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              const barColors: Record<string, string> = {
                slate: 'bg-slate-400', blue: 'bg-blue-400', amber: 'bg-amber-400', violet: 'bg-violet-400',
                rose: 'bg-rose-400', emerald: 'bg-emerald-400', zinc: 'bg-zinc-400',
              };
              return (
                <div key={col.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">{col.label}</span>
                    <span className="text-slate-400">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColors[col.color]} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((t) => {
              const assignee = t.assigned_to ? profiles.find((p) => p.id === t.assigned_to) : null;
              return (
                <div key={t.id} className="flex items-center gap-3 text-sm">
                  {assignee ? <Avatar name={assignee.full_name} size="sm" /> : <div className="w-7 h-7 rounded-full bg-slate-100" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700 truncate">
                      <span className="font-medium">{t.title}</span> moved to {columnMeta(t.status).label}
                    </p>
                    <p className="text-xs text-slate-400">{timeAgo(t.updated_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
