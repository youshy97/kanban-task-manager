import type { Priority, Task } from './types';
import type { Profile } from './types';

interface Suggestion {
  priority: Priority;
  estimatedDays: number;
  bestAssignee: string | null;
  reasoning: string;
}

export function summarizeTask(task: { title: string; description: string | null }): string {
  const text = `${task.title}. ${task.description ?? ''}`.trim();
  if (text.length < 120) return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, 2).join(' ');
}

export function writeDescription(title: string, tags: string[]): string {
  const tagStr = tags.length ? ` This task relates to: ${tags.join(', ')}.` : '';
  return `This task involves ${title.toLowerCase()}. The objective is to complete the required work efficiently while maintaining quality standards. Please ensure all deliverables are met before marking this task as done.${tagStr}`;
}

export function suggestPriority(task: { title: string; description: string | null; due_date: string | null }): Priority {
  const text = `${task.title} ${task.description ?? ''}`.toLowerCase();
  const urgent = /urgent|asap|critical|immediate|blocker|deadline/.test(text);
  if (urgent) return 'critical';
  if (task.due_date) {
    const days = (new Date(task.due_date).getTime() - Date.now()) / 86400000;
    if (days < 3) return 'high';
    if (days < 7) return 'medium';
    return 'low';
  }
  return 'medium';
}

export function suggestDuration(task: { title: string; description: string | null }): number {
  const text = `${task.title} ${task.description ?? ''}`;
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 100) return 10;
  if (wordCount > 50) return 5;
  if (wordCount > 20) return 3;
  return 1;
}

export function suggestAssignee(
  task: { title: string; priority: Priority },
  profiles: Profile[],
  tasks: Task[]
): string | null {
  if (profiles.length === 0) return null;

  const scored = profiles
    .filter((p) => p.role === 'employee' || p.role === 'manager')
    .map((p) => {
      const activeTasks = tasks.filter((t) => t.assigned_to === p.id && t.status !== 'completed' && t.status !== 'cancelled').length;
      const score = 10 - activeTasks * 2 + (task.priority === 'critical' && p.role === 'manager' ? 3 : 0);
      return { profile: p, score: Math.max(score, 0) };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.profile.id ?? profiles[0].id;
}

export function getAISuggestion(task: { title: string; description: string | null; due_date: string | null }, profiles: Profile[], tasks: Task[]): Suggestion {
  const priority = suggestPriority(task);
  const estimatedDays = suggestDuration(task);
  const bestAssignee = suggestAssignee({ title: task.title, priority }, profiles, tasks);
  const assigneeName = profiles.find((p) => p.id === bestAssignee)?.full_name ?? '—';

  return {
    priority,
    estimatedDays,
    bestAssignee,
    reasoning: `Based on the task title and description, this task is best suited for ${assigneeName} who has the most capacity. The priority is set to ${priority} based on keyword analysis and due date proximity. Estimated duration: ${estimatedDays} day(s).`,
  };
}
