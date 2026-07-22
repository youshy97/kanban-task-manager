import { useState, useMemo, type DragEvent } from 'react';
import { Plus, Calendar, CheckSquare, AlertCircle, Edit2, Check, X, Trash2 } from 'lucide-react';
import { COLUMNS as INITIAL_COLUMNS, PRIORITIES, COLUMN_COLORS, priorityMeta } from '../lib/constants';
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
  const [dragOver, setDragOver] = useState<string | null>(null);

  // حالة إدارة الأعمدة ديناميكياً
  const [columns, setColumns] = useState(INITIAL_COLUMNS);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [newColTitle, setNewColTitle] = useState('');
  const [isAddingCol, setIsAddingCol] = useState(false);

  const canEdit = can(profile?.role, 'move_task');

  // تصفية المهام المتاحة للمستخدم الحالي
  const visibleTasks = useMemo(() => {
    if (!profile) return [];
    return tasks.filter((task) => {
      if (profile.role === 'super_admin' || profile.role === 'admin') return true;
      if (task.created_by === profile.id) return true;
      if (task.assigned_to === profile.id) return true;
      if (task.shared_with?.includes(profile.id)) return true;
      return false;
    });
  }, [tasks, profile]);

  // تجميع المهام حسب العمود
  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = {};
    columns.forEach((col) => { map[col.id] = []; });
    for (const t of visibleTasks) {
      if (map[t.status]) {
        map[t.status].push(t);
      }
    }
    return map;
  }, [visibleTasks, columns]);

  // حفظ الاسم الجديد للعمود
  const handleSaveTitle = (id: string) => {
    if (!editingTitle.trim()) return;
    setColumns(columns.map(col => col.id === id ? { ...col, label: editingTitle } : col));
    setEditingColId(null);
  };

  // إضافة عمود جديد
  const handleAddColumn = () => {
    if (!newColTitle.trim()) return;
    const newId = newColTitle.toLowerCase().replace(/\s+/g, '_');
    setColumns([...columns, { id: newId, label: newColTitle, color: 'blue' }]);
    setNewColTitle('');
    setIsAddingCol(false);
  };

  // حذف عمود (بشرط أن يكون فارغاً)
  const handleDeleteColumn = (id: string) => {
    if (grouped[id] && grouped[id].length > 0) {
      alert('لا يمكن حذف العمود لأنه يحتوي على مهام حالية. يرجى نقل المهام أولاً.');
      return;
    }
    setColumns(columns.filter(col => col.id !== id));
  };

  const handleDrop = (e: DragEvent, status: string) => {
    e.preventDefault();
    setDragOver(null);
    if (dragTask && canEdit) onMove(dragTask, status as TaskStatus);
    setDragTask(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto p-4 sm:p-6 h-full items-start" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      {columns.map((col) => {
        const colTasks = grouped[col.id] || [];
        const colors = COLUMN_COLORS[col.color] || COLUMN_COLORS['blue'];
        const isEditing = editingColId === col.id;

        return (
          <div
            key={col.id}
            className={`w-72 flex-shrink-0 rounded-xl flex flex-col transition-all ${dragOver === col.id ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-slate-100/70'}`}
            onDragOver={(e) => { if (canEdit) { e.preventDefault(); setDragOver(col.id); } }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            {/* Header العمود */}
            <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200/50">
              <div className="flex items-center gap-2 flex-1 mr-2">
                <div className={`w-2 h-2 rounded-full ${colors.bar}`} />
                
                {isEditing ? (
                  <div className="flex items-center gap-1 w-full">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="text-xs px-2 py-1 rounded border border-blue-400 w-full bg-white font-medium"
                      autoFocus
                    />
                    <button onClick={() => handleSaveTitle(col.id)} className="text-emerald-600 hover:text-emerald-700">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingColId(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => { setEditingColId(col.id); setEditingTitle(col.label); }}>
                    <h3 className={`text-sm font-semibold ${colors.header}`}>{col.label}</h3>
                    <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}

                <span className="text-xs font-medium text-slate-400 bg-white px-1.5 py-0.5 rounded">{colTasks.length}</span>
              </div>

              <div className="flex items-center gap-1">
                {canEdit && (
                  <>
                    <button onClick={() => onCreate(col.id as TaskStatus)} title="إضافة مهمة" className="text-slate-400 hover:text-slate-600 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteColumn(col.id)} title="حذف العمود" className="text-slate-300 hover:text-red-500 transition-colors ml-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* كروت المهام داخل العمود */}
            <div className="flex-1 px-2 py-2 space-y-2 overflow-y-auto min-h-[150px]">
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
                    {task.tags?.length > 0 && (
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
                        {task.checklist && task.checklist.length > 0 && (
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

      {/* زر إضافة عمود جديد */}
      <div className="w-72 flex-shrink-0">
        {isAddingCol ? (
          <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200">
            <input
              type="text"
              placeholder="اسم العمود الجديد..."
              value={newColTitle}
              onChange={(e) => setNewColTitle(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 mb-2 bg-white"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddColumn}
                className="flex-1 bg-blue-600 text-white text-xs font-medium py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                إضافة
              </button>
              <button
                onClick={() => setIsAddingCol(false)}
                className="px-3 bg-slate-200 text-slate-600 text-xs font-medium py-1.5 rounded-lg hover:bg-slate-300 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingCol(true)}
            className="w-full border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 rounded-xl p-4 flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            إضافة عمود جديد
          </button>
        )}
      </div>
    </div>
  );
}

export { PRIORITIES };
