import { useState } from 'react';
import { KanbanBoard } from '../components/KanbanBoard';
import { TaskModal } from '../components/TaskModal';
import { Button, Modal, Input, Textarea, Select } from '../components/ui';
import { Plus, Download, FileText, FileSpreadsheet, Printer } from 'lucide-react';
import type { Task, TaskStatus, Priority, Profile } from '../lib/types';
import { COLUMNS, PRIORITIES } from '../lib/constants';
import { createTask, moveTask } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { can } from '../lib/rbac';
import { exportCSV, exportExcel, exportPDF, printTasks } from '../lib/exporter';

export function BoardPage({
  tasks, profiles, onChanged,
}: {
  tasks: Task[];
  profiles: Profile[];
  onChanged: () => void;
}) {
  const { profile } = useAuth();
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const canEdit = can(profile?.role, 'edit_task');
  const canExport = can(profile?.role, 'export_data');

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus>('backlog');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newDue, setNewDue] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('');  // NEW: Primary assignee
  const [newSharedWith, setNewSharedWith] = useState<string[]>([]);  // NEW: Shared users
  const [showShareMenu, setShowShareMenu] = useState(false);  // NEW

  const handleCreate = async () => {
    if (!newTitle.trim() || !profile) return;
    try {
      await createTask({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        status: newStatus,
        priority: newPriority,
        due_date: newDue ? new Date(newDue).toISOString() : null,
        tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
        created_by: profile.id,
        assigned_to: newAssignedTo || null,
        shared_with: newSharedWith,  // NEW: Save shared users
      });
      // Reset form
      setNewTitle('');
      setNewDesc('');
      setNewStatus('backlog');
      setNewPriority('medium');
      setNewDue('');
      setNewTags('');
      setNewAssignedTo('');
      setNewSharedWith([]);
      setCreating(false);
      onChanged();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  // NEW: Toggle sharing with a user
  const toggleShareUser = (userId: string) => {
    setNewSharedWith((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // ... rest of component ...

  return (
    <div className="h-full">
      {/* ... existing header code ... */}

      <KanbanBoard tasks={tasks} profiles={profiles} onMove={handleMove} onEdit={setEditing} onCreate={(s) => { setNewStatus(s); setCreating(true); }} />

      {editing && (
        <TaskModal
          task={editing}
          profiles={profiles}
          onClose={() => setEditing(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Create New Task" size="lg">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title..." autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <Textarea rows={3} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Describe the task..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value as TaskStatus)}>
                {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <Select value={newPriority} onChange={(e) => setNewPriority(e.target.value as Priority)}>
                {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <Input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
              <Input value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="design, urgent" />
            </div>
          </div>

          {/* NEW: Primary Assignee */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
            <Select value={newAssignedTo} onChange={(e) => setNewAssignedTo(e.target.value)}>
              <option value="">Select assignee...</option>
              {profiles.filter((p) => p.role === 'employee' || p.role === 'manager').map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </Select>
          </div>

          {/* NEW: Share With Multiple Users */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Share With</label>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-left"
                onClick={() => setShowShareMenu(!showShareMenu)}
              >
                {newSharedWith.length > 0
                  ? `${newSharedWith.length} user${newSharedWith.length !== 1 ? 's' : ''} selected`
                  : 'Select team members...'}
              </Button>
              {showShareMenu && (
                <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-xl border border-slate-200 z-20 max-h-48 overflow-y-auto">
                  {profiles
                    .filter((p) => p.role === 'employee' || p.role === 'manager')
                    .map((p) => (
                      <label key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newSharedWith.includes(p.id)}
                          onChange={() => toggleShareUser(p.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600"
                        />
                        <span className="text-sm text-slate-700">{p.full_name}</span>
                      </label>
                    ))}
                </div>
              )}
            </div>
            {newSharedWith.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {newSharedWith.map((userId) => {
                  const user = profiles.find((p) => p.id === userId);
                  return (
                    <span key={userId} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                      {user?.full_name}
                      <button onClick={() => toggleShareUser(userId)} className="ml-1 text-blue-500 hover:text-blue-700">
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim()}>Create Task</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
