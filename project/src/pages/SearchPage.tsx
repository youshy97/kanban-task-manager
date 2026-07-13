import { useMemo, useRef, useState } from 'react';
import { Download, Upload, FileText, FileSpreadsheet, Printer, Search as SearchIcon, X } from 'lucide-react';
import type { Task, Profile } from '../lib/types';
import { useAuth } from '../lib/auth';
import { COLUMNS, PRIORITIES, priorityMeta, columnMeta } from '../lib/constants';
import { isOverdue, fmtDate } from '../lib/format';
import { exportCSV, exportExcel, exportPDF, printTasks, importTasks } from '../lib/exporter';
import { createTask } from '../lib/hooks';
import { Button, Select, Input, Avatar, EmptyState } from '../components/ui';
import { can } from '../lib/rbac';

export function SearchPage({
  tasks, profiles, onImported,
}: {
  tasks: Task[];
  profiles: Profile[];
  onImported: () => void;
}) {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [showExport, setShowExport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (query && !t.title.toLowerCase().includes(query.toLowerCase()) && !(t.description ?? '').toLowerCase().includes(query.toLowerCase())) return false;
      if (filterEmployee && t.assigned_to !== filterEmployee) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterDate) {
        const taskDate = new Date(t.created_at).toISOString().slice(0, 10);
        if (taskDate !== filterDate) return false;
      }
      return true;
    });
  }, [tasks, query, filterEmployee, filterPriority, filterStatus, filterDate]);

  const canExport = can(profile?.role, 'export_data');
  const canImport = can(profile?.role, 'import_data');

  const handleImport = async (file: File) => {
    try {
      const imported = await importTasks(file);
      for (const t of imported) {
        if (!t.title) continue;
        await createTask({
          ...t,
          status: (t.status as Task['status']) || 'backlog',
          priority: (t.priority as Task['priority']) || 'medium',
        });
      }
      onImported();
      alert(`Imported ${imported.length} tasks successfully.`);
    } catch {
      alert('Import failed. Please check the file format.');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Search & Filter</h1>
          <p className="text-slate-500 text-sm mt-1">Find tasks across your workspace.</p>
        </div>
        {(canExport || canImport) && (
          <div className="flex items-center gap-2">
            {canImport && (
              <>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ''; }} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4" /> Import
                </Button>
              </>
            )}
            {canExport && (
              <div className="relative">
                <Button size="sm" onClick={() => setShowExport(!showExport)}>
                  <Download className="w-4 h-4" /> Export
                </Button>
                {showExport && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExport(false)} />
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-slate-200 z-20 py-1">
                      <button onClick={() => { exportExcel(filtered, profiles); setShowExport(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
                      </button>
                      <button onClick={() => { exportPDF(filtered, profiles); setShowExport(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        <FileText className="w-4 h-4 text-red-600" /> PDF
                      </button>
                      <button onClick={() => { exportCSV(filtered, profiles); setShowExport(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        <FileText className="w-4 h-4 text-blue-600" /> CSV
                      </button>
                      <button onClick={() => { printTasks(filtered, profiles); setShowExport(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        <Printer className="w-4 h-4 text-slate-600" /> Print
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks by title or description..." className="pl-11 text-base" />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}>
          <option value="">All Employees</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </Select>
        <Select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
      </div>

      <p className="text-sm text-slate-500">{filtered.length} task{filtered.length !== 1 ? 's' : ''} found</p>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState icon={<SearchIcon className="w-12 h-12" />} title="No tasks found" subtitle="Try adjusting your search or filters." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Task</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Assigned</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => {
                  const pm = priorityMeta(t.priority);
                  const assignee = t.assigned_to ? profiles.find((p) => p.id === t.assigned_to) : null;
                  const overdue = isOverdue(t.due_date, t.status);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{t.title}</p>
                        {t.tags.length > 0 && <div className="flex gap-1 mt-1">{t.tags.slice(0, 3).map((tag) => <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{tag}</span>)}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pm.bg} ${pm.text} border ${pm.border}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${pm.dot} mr-1`} />{pm.label}
                        </span>
                      </td>
                      <td className="px-4 py-3"><span className="text-sm text-slate-600">{columnMeta(t.status).label}</span></td>
                      <td className="px-4 py-3">
                        {assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={assignee.full_name} size="sm" />
                            <span className="text-sm text-slate-700">{assignee.full_name}</span>
                          </div>
                        ) : <span className="text-sm text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>{fmtDate(t.due_date)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
