import { useState, useMemo, type DragEvent } from 'react';
import { Plus, Calendar, CheckSquare, AlertCircle } from 'lucide-react';
import { COLUMNS, PRIORITIES, COLUMN_COLORS, priorityMeta } from '../lib/constants';
import type { Task, TaskStatus, Profile } from '../lib/types';
import { Avatar } from './ui';
import { isOverdue, fmtDate } from '../lib/format';
import { can } from '../lib/rbac';
import { useAuth } from '../lib/auth';

interface BoardProps {
  tasks: Task[];
  profiles: Profile[];
  onMove: (taskId: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onCreate: (status: TaskStatus) => void;
}

export function KanbanBoard({ tasks, profiles, onMove, onEdit, onCreate }: BoardProps) {
  const { profile } = useAuth();
  const [dragTask, setDragTask] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const canEdit = can(profile?.role, 'move_task');

  // NEW: Filter tasks visible to current user
  const visibleTasks = useMemo(() => {
    if (!profile) return [];
    return tasks.filter((task) => {
      // Super admins see all tasks
      if (profile.role === 'super_admin' || profile.role === 'admin') return true;
      // Show if user created the task
      if (task.created_by === profile.id) return true;
      // Show if task is assigned to this user
      if (task.assigned_to === profile.id) return true;
      // Show if task is shared with this user
      if (task.shared_with?.includes(profile.id)) return true;
      return false;
    });
  }, [tasks, profile]);

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      backlog: [], todo: [], in_progress: [], review: [], blocked: [], completed: [], cancelled: [],
    };
    for (const t of visibleTasks) map[t.status].push(t);
    return map;
  }, [visibleTasks]);

  const handleDrop = (e: DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOver(null);
    if (dragTask && canEdit) onMove(dragTask, status);
    setDragTask(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto p-4 sm:p-6 h-full" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      {COLUMNS.map((col) => {
        const colTasks = grouped[col.id];
        const colors = COLUMN_COLORS[col.color];
        return (
          <div
            key={col.id}
            className={`w-72 flex-shrink-0 rounded-xl flex flex-col transition-all ${dragOver === col.id ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-slate-100/70'}`}
            onDragOver={(e) => { if (canEdit) { e.preventDefault(); setDragOver(col.id); } }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="flex items-center justify-between px-3 py-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${colors.bar}`} />
                <h3 className={`text-sm font-semibold ${colors.header}`}>{col.label}</h3>
                <span className="text-xs font-medium text-slate-400 bg-white px-1.5 py-0.5 rounded">{colTasks.length}</span>
              </div>
              {canEdit && (
                <button onClick={() => onCreate(col.id)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto">
              {colTasks.map((task) => {
                const assignee = task.assigned_to ? profiles.find((p) => p.id === task.assigned_to) : null;
                const overdue = isOverdue(task.due_date, task.status);
                const pm = priorityMeta(task.priority);
                const checkedItems = task.checklist?.filter((c) => c.checked).length ?? 0;
                return (
                  <div
                    key={task.id}
                    draggable={canEdit}
                    onDragStart={() => setDragTask(task.id)}
                    onDragEnd={() => { setDragTask(null); setDragOver(null); }}
                    onClick={() => onEdit(task)}
                    className={`bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all ${dragTask === task.id ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pm.bg} ${pm.text} ${pm.border} border`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${pm.dot} mr-1`} />
                        {pm.label}
                      </span>
                      {overdue && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    </div>
                    <h4 className="text-sm font-medium text-slate-900 mb-1 line-clamp-2">{task.title}</h4>
                    {task.description && <p className="text-xs text-slate-500 mb-2 line-clamp-2">{task.description}</p>}
                    {task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {task.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{tag}</span>
                        ))}
                      </div>
                    )}
                    {task.completion > 0 && (
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                          <span>Progress</span>
                          <span>{task.completion}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${task.completion}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {task.due_date && (
                          <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : ''}`}>
                            <Calendar className="w-3 h-3" />
                            {fmtDate(task.due_date)}
                          </span>
                        )}
                        {task.checklist?.length > 0 && (
                          <span className="flex items-center gap-1">
                            <CheckSquare className="w-3 h-3" />
                            {checkedItems}/{task.checklist.length}
                          </span>
                        )}
                      </div>
                      {assignee ? (
                        <Avatar name={assignee.full_name} size="sm" />
                      ) : (
                        <div className="w-7 h-7 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 text-xs">
                          ?
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {colTasks.length === 0 && (
                <div className="text-center py-8 text-slate-300 text-xs">No tasks</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { PRIORITIES };
