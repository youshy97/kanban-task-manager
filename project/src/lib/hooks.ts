import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { ActivityLog, Attachment, Comment, Notification, Profile, Task, TaskStatus } from './types';

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('profiles')
      .select('*')
      .order('full_name')
      .then(({ data }) => {
        if (mounted) {
          setProfiles((data as Profile[]) ?? []);
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { profiles, loading };
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    setTasks((data as Task[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { tasks, loading, refresh };
}

export async function createTask(input: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase.from('tasks').insert(input).select().single();
  if (error) throw error;
  await supabase.from('activity_logs').insert({
    task_id: (data as Task).id,
    action: 'created',
    detail: `Task "${(data as Task).title}" created`,
  });
  return data as Task;
}

export async function updateTask(id: string, patch: Partial<Task>, log?: { action: string; detail?: string; old_value?: string; new_value?: string }) {
  const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single();
  if (error) throw error;
  if (log) {
    await supabase.from('activity_logs').insert({ task_id: id, action: log.action, detail: log.detail, old_value: log.old_value, new_value: log.new_value });
  }
  return data as Task;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function moveTask(id: string, status: TaskStatus) {
  const patch: Partial<Task> = { status };
  if (status === 'completed') patch.completion = 100;
  return updateTask(id, patch, { action: 'status_changed', detail: `Status changed to ${status}`, new_value: status });
}

export function useComments(taskId: string | null) {
  const [comments, setComments] = useState<Comment[]>([]);

  const refresh = useCallback(async () => {
    if (!taskId) return;
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    setComments((data as Comment[]) ?? []);
  }, [taskId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { comments, refresh, add: async (content: string, userId: string) => {
    const { data } = await supabase.from('comments').insert({ task_id: taskId, user_id: userId, content }).select().single();
    await supabase.from('activity_logs').insert({ task_id: taskId, action: 'commented', detail: 'Added a comment' });
    if (data) setComments((c) => [...c, data as Comment]);
  }};
}

export function useAttachments(taskId: string | null) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const refresh = useCallback(async () => {
    if (!taskId) return;
    const { data } = await supabase.from('attachments').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
    setAttachments((data as Attachment[]) ?? []);
  }, [taskId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { attachments, refresh, remove: async (id: string, path: string) => {
    await supabase.storage.from('attachments').remove([path]);
    await supabase.from('attachments').delete().eq('id', id);
    setAttachments((a) => a.filter((x) => x.id !== id));
  }};
}

export function useActivityLog(taskId: string | null) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!taskId) return;
    supabase
      .from('activity_logs')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setLogs((data as ActivityLog[]) ?? []));
  }, [taskId]);

  return logs;
}

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    const list = (data as Notification[]) ?? [];
    setNotifications(list);
    setUnread(list.filter((n) => !n.read).length);
  }, [userId]);

  useEffect(() => {
    refresh();
    if (!userId) return;
    const channel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, userId]);

  return {
    notifications,
    unread,
    refresh,
    markRead: async (id: string) => {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
      refresh();
    },
    markAllRead: async () => {
      if (!userId) return;
      await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
      refresh();
    },
  };
}

export async function assignTask(task: Task, assigneeId: string, assignerName: string, assigneeName: string) {
  await updateTask(task.id, { assigned_to: assigneeId }, { action: 'assigned', detail: `Assigned to ${assigneeName}`, new_value: assigneeName });

  await supabase.from('notifications').insert({
    user_id: assigneeId,
    type: 'task_assigned',
    title: 'New Task Assigned',
    message: `Task "${task.title}" has been assigned to you by ${assignerName}.`,
    related_task_id: task.id,
  });

  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-task-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({
        to: '',
        taskId: task.id,
        taskName: task.title,
        priority: task.priority,
        employeeName: assigneeName,
        assignerName,
      }),
    });
  } catch {
    // Email sending is best-effort; the in-app notification is the primary channel.
  }
}
