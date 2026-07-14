import { useState, useRef, useEffect } from 'react';
import {
  X, Calendar, User, Tag, MessageSquare, Paperclip, CheckSquare,
  Activity, Trash2, Send, Upload, UserPlus, Clock,
} from 'lucide-react';
import { Modal, Button, Input, Textarea, Select, Avatar, Badge } from './ui';
import { PRIORITIES, COLUMNS, priorityMeta, columnMeta } from '../lib/constants';
import type { Task, TaskStatus, Priority, Profile, ChecklistItem, Comment, Attachment, ActivityLog } from '../lib/types';
import { useAuth } from '../lib/auth';
import { useComments, useAttachments, useActivityLog, assignTask, updateTask, deleteTask } from '../lib/hooks';
import { fmtDate, fmtDateTime, timeAgo, isOverdue } from '../lib/format';
import { can } from '../lib/rbac';
import { supabase } from '../lib/supabase';

const BUCKET = 'attachments';

export function TaskModal({
  task, profiles, onClose, onUpdated, onDeleted,
}: {
  task: Task;
  profiles: Profile[];
  onClose: () => void;
  onUpdated: (t: Task) => void;
  onDeleted: (id: string) => void;
}) {
  const { profile } = useAuth();
  const { comments, add: addComment } = useComments(task.id);
  const { attachments, remove: removeAttachment } = useAttachments(task.id);
  const logs = useActivityLog(task.id);
  const [tab, setTab] = useState<'comments' | 'attachments' | 'checklist' | 'activity'>('comments');
  const [commentText, setCommentText] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [assignMenu, setAssignMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [completion, setCompletion] = useState(task.completion);
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.slice(0, 10) : '');
  const [tags, setTags] = useState(task.tags.join(', '));
  const fileRef = useRef<HTMLInputElement>(null);

  const canEdit = can(profile?.role, 'edit_task');
  const canAssign = can(profile?.role, 'assign_task');
  const assignee = task.assigned_to ? profiles.find((p) => p.id === task.assigned_to) : null;
  const creator = profiles.find((p) => p.id === task.created_by);
  const pm = priorityMeta(task.priority);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setStatus(task.status);
    setPriority(task.priority);
    setCompletion(task.completion);
    setDueDate(task.due_date ? task.due_date.slice(0, 10) : '');
    setTags(task.tags.join(', '));
  }, [task.id, task.title, task.description, task.status, task.priority, task.completion, task.due_date, task.tags]);

  const saveEdit = async () => {
    const patch: Partial<Task> = {
      title,
      description,
      status,
      priority,
      completion: status === 'completed' ? 100 : completion,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    const updated = await updateTask(task.id, patch, { action: 'updated', detail: 'Task details updated' });
    setEditing(false);
    onUpdated(updated);
  };

  const handleAssign = async (assigneeId: string) => {
    if (!profile) return;
    const assigneeProfile = profiles.find((p) => p.id === assigneeId);
    if (!assigneeProfile) return;
    await assignTask(task, assigneeId, profile.full_name, assigneeProfile.full_name);
    setAssignMenu(false);
    onUpdated({ ...task, assigned_to: assigneeId });
  };

  const toggleChecklist = async (idx: number) => {
    const checklist = [...(task.checklist || [])];
    checklist[idx] = { ...checklist[idx], checked: !checklist[idx].checked };
    const updated = await updateTask(task.id, { checklist }, { action: 'updated', detail: 'Checklist updated' });
    onUpdated(updated);
  };

  const addChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;
    const checklist: ChecklistItem[] = [...(task.checklist || []), { text: newChecklistItem.trim(), checked: false }];
    const updated = await updateTask(task.id, { checklist }, { action: 'updated', detail: 'Checklist item added' });
    setNewChecklistItem('');
    onUpdated(updated);
  };

  const removeChecklistItem = async (idx: number) => {
    const checklist = (task.checklist || []).filter((_, i) => i !== idx);
    const updated = await updateTask(task.id, { checklist }, { action: 'updated', detail: 'Checklist item removed' });
    onUpdated(updated);
  };

const handleFile = async (file: File) => {
  if (!profile) return;
  const path = `${task.id}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
  if (upErr) return;
  await supabase.from('attachments').insert({
    task_id: task.id,
    user_id: profile.id,
    file_name: file.name,
    file_path: path,
    file_size: file.size,
    file_type: file.type,
  });
  await supabase.from('activity_logs').insert({ task_id: task.id, action: 'uploaded', detail: `Uploaded ${file.name}` });
};

  const handleDelete = async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    await deleteTask(task.id);
    onDeleted(task.id);
  };

  const tabs = [
    { id: 'comments' as const, label: 'Comments', icon: MessageSquare, count: comments.length },
    { id: 'attachments' as const, label: 'Files', icon: Paperclip, count: attachments.length },
    { id: 'checklist' as const, label: 'Checklist', icon: CheckSquare, count: task.checklist?.length ?? 0 },
    { id: 'activity' as const, label: 'Activity', icon: Activity, count: logs.length },
  ];

  return (
    <Modal open onClose={onClose} size="xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {editing ? (
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold" />
            ) : (
              <h2 className="text-lg font-semibold text-slate-900">{task.title}</h2>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pm.bg} ${pm.text} ${pm.border} border`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${pm.dot} mr-1`} />
                {pm.label}
              </span>
              <Badge className="bg-slate-100 text-slate-600 border-slate-200">{columnMeta(task.status).label}</Badge>
              {isOverdue(task.due_date, task.status) && (
                <Badge className="bg-red-50 text-red-700 border-red-200">Overdue</Badge>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col lg:flex-row max-h-[70vh]">
        {/* Left: details */}
        <div className="flex-1 p-6 overflow-y-auto">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                    {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                    {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Completion %</label>
                  <Input type="number" min={0} max={100} value={completion} onChange={(e) => setCompletion(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma-separated)</label>
                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="frontend, urgent, design" />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveEdit}>Save Changes</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 whitespace-pre-wrap mb-4">{task.description || 'No description provided.'}</p>
              {task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {task.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-md flex items-center gap-1">
                      <Tag className="w-3 h-3" />{tag}
                    </span>
                  ))}
                </div>
              )}
              {task.completion > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Completion</span><span>{task.completion}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${task.completion}%` }} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 mt-6 mb-4">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
                {t.count > 0 && <span className="text-xs bg-slate-100 px-1.5 rounded">{t.count}</span>}
              </button>
            ))}
          </div>

          {tab === 'comments' && (
            <div className="space-y-3">
              {comments.map((c: Comment) => {
                const author = profiles.find((p) => p.id === c.user_id);
                return (
                  <div key={c.id} className="flex gap-2">
                    <Avatar name={author?.full_name ?? '?'} size="sm" />
                    <div className="flex-1">
                      <div className="bg-slate-50 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-700">{author?.full_name ?? 'Unknown'}</span>
                          <span className="text-[10px] text-slate-400">{timeAgo(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{c.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {comments.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No comments yet</p>}
              <div className="flex gap-2 mt-3">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  onKeyDown={(e) => { if (e.key === 'Enter' && commentText.trim() && profile) { addComment(commentText.trim(), profile.id); setCommentText(''); } }}
                />
                <Button onClick={() => { if (commentText.trim() && profile) { addComment(commentText.trim(), profile.id); setCommentText(''); } }}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {tab === 'attachments' && (
            <div className="space-y-2">
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4" /> Upload File
              </Button>
              {attachments.map((a: Attachment) => (
                <div key={a.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                  <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{a.file_name}</p>
                    <p className="text-xs text-slate-400">{(a.file_size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={() => removeAttachment(a.id, a.file_path)} className="text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {attachments.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No attachments</p>}
            </div>
          )}

          {tab === 'checklist' && (
            <div className="space-y-2">
              {(task.checklist || []).map((item: ChecklistItem, idx: number) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <input type="checkbox" checked={item.checked} onChange={() => toggleChecklist(idx)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span className={`text-sm flex-1 ${item.checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</span>
                  <button onClick={() => removeChecklistItem(idx)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {canEdit && (
                <div className="flex gap-2 mt-2">
                  <Input value={newChecklistItem} onChange={(e) => setNewChecklistItem(e.target.value)} placeholder="Add checklist item..." onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem(); }} />
                  <Button variant="outline" size="sm" onClick={addChecklistItem}><Plus className="w-4 h-4" /></Button>
                </div>
              )}
              {(task.checklist || []).length === 0 && <p className="text-center text-slate-400 text-sm py-4">No checklist items</p>}
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-3">
              {logs.map((log: ActivityLog) => {
                const author = profiles.find((p) => p.id === log.user_id);
                return (
                  <div key={log.id} className="flex gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                    <div>
                      <p className="text-slate-700">
                        <span className="font-medium">{author?.full_name ?? 'Someone'}</span> {log.detail || log.action}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(log.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              {logs.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No activity yet</p>}
            </div>
          )}
        </div>

        {/* Right: sidebar */}
        <div className="lg:w-64 p-6 lg:border-l border-slate-100 bg-slate-50/50 space-y-4">
          {/* Assignee */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <User className="w-3 h-3" /> Assignee
            </p>
            {assignee ? (
              <div className="flex items-center gap-2">
                <Avatar name={assignee.full_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{assignee.full_name}</p>
                  <p className="text-xs text-slate-400 truncate">{assignee.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Unassigned</p>
            )}
            {canAssign && (
              <div className="relative mt-2">
                <Button variant="outline" size="sm" className="w-full" onClick={() => setAssignMenu(!assignMenu)}>
                  <UserPlus className="w-3.5 h-3.5" /> Assign Task
                </Button>
                {assignMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAssignMenu(false)} />
                    <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-xl border border-slate-200 z-20 max-h-48 overflow-y-auto">
                      {profiles.filter((p) => p.role === 'employee' || p.role === 'manager').map((p) => (
                        <button key={p.id} onClick={() => handleAssign(p.id)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left">
                          <Avatar name={p.full_name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{p.full_name}</p>
                            <p className="text-xs text-slate-400 capitalize">{p.role}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Dates */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Due Date
            </p>
            <p className={`text-sm ${isOverdue(task.due_date, task.status) ? 'text-red-600 font-medium' : 'text-slate-700'}`}>
              {fmtDate(task.due_date)}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Created
            </p>
            <p className="text-sm text-slate-700">{fmtDate(task.created_at)}</p>
            {creator && <p className="text-xs text-slate-400 mt-0.5">by {creator.full_name}</p>}
          </div>

          {canEdit && (
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <Button variant="outline" size="sm" className="w-full" onClick={() => setEditing(!editing)}>
                {editing ? 'Cancel Edit' : 'Edit Task'}
              </Button>
              <Button variant="danger" size="sm" className="w-full" onClick={handleDelete}>
                <Trash2 className="w-3.5 h-3.5" /> Delete Task
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

import { Plus } from 'lucide-react';
