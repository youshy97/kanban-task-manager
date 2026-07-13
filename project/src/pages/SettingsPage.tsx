import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Button, Input, Avatar } from '../components/ui';
import { ROLES, roleLabel } from '../lib/constants';
import { roleBadgeClass } from '../lib/format';
import { useState, useEffect } from 'react';
import type { Profile } from '../lib/types';
import { useProfiles } from '../lib/hooks';

export function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const { profiles, loading } = useProfiles();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
  }, [profile?.full_name]);

  if (!profile) return null;

  const save = async () => {
    setSaving(true);
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const changeRole = async (userId: string, role: Profile['role']) => {
    await supabase.from('profiles').update({ role }).eq('id', userId);
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your profile and workspace settings.</p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">My Profile</h2>
        <div className="flex items-center gap-4 mb-6">
          <Avatar name={profile.full_name} size="lg" />
          <div>
            <p className="font-medium text-slate-900">{profile.full_name}</p>
            <p className="text-sm text-slate-500">{profile.email}</p>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium border ${roleBadgeClass(profile.role)}`}>
              {roleLabel(profile.role)}
            </span>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            {saved && <span className="text-sm text-emerald-600">Saved!</span>}
          </div>
        </div>
      </div>

      {/* User management */}
      {(profile.role === 'super_admin' || profile.role === 'admin') && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">User Management</h2>
          {loading ? (
            <p className="text-slate-400 text-sm">Loading...</p>
          ) : (
            <div className="space-y-2">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Avatar name={p.full_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{p.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{p.email}</p>
                  </div>
                  <select
                    value={p.role}
                    onChange={(e) => changeRole(p.id, e.target.value as Profile['role'])}
                    disabled={p.id === profile.id}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
