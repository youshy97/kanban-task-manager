import { useState } from 'react';
import { Sparkles, X, Wand2, Lightbulb, FileText, UserCog, Send } from 'lucide-react';
import type { Task, Profile } from '../lib/types';
import { getAISuggestion, summarizeTask, writeDescription, suggestPriority, suggestDuration } from '../lib/ai';
import { Button, Select } from './ui';

export function AIAssistant({
  open, onClose, tasks, profiles,
}: {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  profiles: Profile[];
}) {
  const [mode, setMode] = useState<'summarize' | 'describe' | 'suggest'>('suggest');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc] = useState('');
  const [tags, setTags] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const runAI = async () => {
    setLoading(true);
    setResult('');
    await new Promise((r) => setTimeout(r, 500));

    if (mode === 'summarize') {
      const task = tasks.find((t) => t.id === selectedTaskId);
      if (task) setResult(summarizeTask(task));
    } else if (mode === 'describe') {
      const title = customTitle || tasks.find((t) => t.id === selectedTaskId)?.title || '';
      setResult(writeDescription(title, tags.split(',').map((t) => t.trim()).filter(Boolean)));
    } else if (mode === 'suggest') {
      const task = tasks.find((t) => t.id === selectedTaskId);
      if (task) {
        const s = getAISuggestion(task, profiles, tasks);
        setResult(
          `Priority: ${s.priority.toUpperCase()}\n` +
          `Estimated Duration: ${s.estimatedDays} day(s)\n` +
          `Best-suited Employee: ${profiles.find((p) => p.id === s.bestAssignee)?.full_name ?? '—'}\n\n` +
          `Reasoning:\n${s.reasoning}`
        );
      } else {
        const dummy = { title: customTitle, description: customDesc, due_date: null };
        const priority = suggestPriority(dummy);
        const duration = suggestDuration(dummy);
        setResult(
          `Priority: ${priority.toUpperCase()}\n` +
          `Estimated Duration: ${duration} day(s)\n\n` +
          `Reasoning:\nBased on the provided title and description, this task is analyzed for complexity and urgency. ` +
          `The suggested priority is ${priority}. Estimated completion time is ${duration} day(s).`
        );
      }
    }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed right-0 top-16 bottom-0 w-full sm:w-96 bg-white border-l border-slate-200 shadow-2xl z-30 flex flex-col animate-slideInRight">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="flex items-center gap-2 text-white">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Assistant</h3>
            <p className="text-xs text-blue-100">Smart task insights</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'suggest' as const, label: 'Suggest', icon: Lightbulb },
            { id: 'summarize' as const, label: 'Summarize', icon: FileText },
            { id: 'describe' as const, label: 'Describe', icon: Wand2 },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex flex-col items-center gap-1 py-3 rounded-lg text-xs font-medium transition-all ${
                mode === m.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <m.icon className="w-4 h-4" />
              {m.label}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          {mode === 'suggest' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Select Task</label>
              <Select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}>
                <option value="">Choose a task...</option>
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
            </div>
          )}
          {mode === 'summarize' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Select Task</label>
              <Select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}>
                <option value="">Choose a task...</option>
                {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
            </div>
          )}
          {mode === 'describe' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Task Title</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Enter task title..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tags (comma-separated)</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="frontend, api, design"
                />
              </div>
            </>
          )}
        </div>

        <Button onClick={runAI} className="w-full" disabled={loading || (mode !== 'describe' && !selectedTaskId)}>
          {loading ? 'Analyzing...' : 'Run AI Analysis'}
          {!loading && <Send className="w-3.5 h-3.5" />}
        </Button>

        {/* Result */}
        {result && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">AI Result</span>
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{result}</p>
          </div>
        )}

        {/* Info */}
        <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500 leading-relaxed">
          <p className="font-medium text-slate-600 mb-1 flex items-center gap-1">
            <UserCog className="w-3.5 h-3.5" /> How it works
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li><b>Suggest</b>: Analyzes a task and recommends priority, duration & best assignee.</li>
            <li><b>Summarize</b>: Generates a concise summary of any task.</li>
            <li><b>Describe</b>: Writes a professional description from a title.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
