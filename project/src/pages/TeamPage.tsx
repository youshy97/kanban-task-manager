import { useMemo, useState } from 'react';
import { Mail, User as UserIcon, AlertCircle } from 'lucide-react';
import type { Profile, Task } from '../lib/types';
import { ROLES, roleLabel } from '../lib/constants';
import { roleBadgeClass, fmtDate } from '../lib/format';
import { Avatar } from '../components/ui';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { can } from '../lib/rbac';

export function TeamPage({ profiles: initialProfiles, tasks, onChanged }: { profiles: Profile[]; tasks: Task[]; onChanged: () => void }) {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState(initialProfiles);  // NEW: Local state for profiles
  const [loading, setLoading] = useState(false);  // NEW: Loading state
  const [error, setError] = useState<string | null>(null);  // NEW: Error state
  const canManage = can(profile?.role, 'manage_users');

  const stats = useMemo(() => {
    const map: Record<string, { active: number; completed: number }> = {};
    for (const p of profiles) map[p.id] = { active: 0, completed: 0 };
    for (const t of tasks) {
      if (!t.assigned_to) continue;
      if (!map[t.assigned_to]) continue;
      if (t.status === 'completed') map[t.assigned_to].completed++;
      else if (t.status !== 'cancelled') map[t.assigned_to].active++;
    }
    return map;
  }, [profiles, tasks]);

  // NEW: Enhanced changeRole with error handling and local state update
  const changeRole = async (userId: string, newRole: Profile['role']) => {
    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Update local state immediately for UI feedback
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p))
      );

      // Also call parent refresh to sync with other components
      onChanged();
    } catch (err) {
      console.error('Failed to update role:', err);
      setError(`Failed to update role for ${profiles.find((p) => p.id === userId)?.full_name}`);
      // Revert local state on error
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team</h1>
        <p className="text-slate-500 text-sm mt-1">{profiles.length} member{profiles.length !== 1 ? 's' : ''} in your workspace.</p>
      </div>

      {/* NEW: Error notification */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3 mb-4">
              <Avatar name={p.full_name} size="lg" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 truncate">{p.full_name}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 truncate mt-0.5">
                  <Mail className="w-3 h-3" />{p.email}
                </p>
                <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium border ${roleBadgeClass(p.role)}`}>
                  {roleLabel(p.role)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="text-center bg-slate-50 rounded-lg py-2">
                <p className="text-lg font-bold text-blue-600">{stats[p.id]?.active ?? 0}</p>
                <p className="text-xs text-slate-500">Active</p>
              </div>
              <div className="text-center bg-slate-50 rounded-lg py-2">
                <p className="text-lg font-bold text-emerald-600">{stats[p.id]?.completed ?? 0}</p>
                <p className="text-xs text-slate-500">Done</p>
              </div>
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-1 mb-3">
              <UserIcon className="w-3 h-3" /> Joined {fmtDate(p.created_at)}
            </div>

            {canManage && p.id !== profile?.id && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                <select
                  value={p.role}
                  onChange={(e) => changeRole(p.id, e.target.value as Profile['role'])}
                  disabled={loading}  // NEW: Disable while loading
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
