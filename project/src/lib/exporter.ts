import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Task, Profile } from './types';
import { fmtDate } from './format';

export function exportCSV(tasks: Task[], profiles: Profile[]) {
  const rows = tasks.map((t) => ({
    Title: t.title,
    Description: t.description ?? '',
    Status: t.status,
    Priority: t.priority,
    Completion: t.completion,
    Assigned: profiles.find((p) => p.id === t.assigned_to)?.full_name ?? '',
    Created: fmtDate(t.created_at),
    'Due Date': fmtDate(t.due_date),
    Tags: t.tags.join(', '),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  download(csv, 'tasks.csv', 'text/csv');
}

export function exportExcel(tasks: Task[], profiles: Profile[]) {
  const rows = tasks.map((t) => ({
    Title: t.title,
    Description: t.description ?? '',
    Status: t.status,
    Priority: t.priority,
    Completion: t.completion,
    Assigned: profiles.find((p) => p.id === t.assigned_to)?.full_name ?? '',
    Created: fmtDate(t.created_at),
    'Due Date': fmtDate(t.due_date),
    Tags: t.tags.join(', '),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
  XLSX.writeFile(wb, 'tasks.xlsx');
}

export function exportPDF(tasks: Task[], profiles: Profile[]) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Task Report', 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

  autoTable(doc, {
    startY: 36,
    head: [['Title', 'Status', 'Priority', 'Assigned', 'Due Date', 'Completion']],
    body: tasks.map((t) => [
      t.title,
      t.status,
      t.priority,
      profiles.find((p) => p.id === t.assigned_to)?.full_name ?? '—',
      fmtDate(t.due_date),
      `${t.completion}%`,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save('tasks.pdf');
}

export function printTasks(tasks: Task[], profiles: Profile[]) {
  const win = window.open('', '_blank');
  if (!win) return;
  const rows = tasks
    .map(
      (t) => `<tr>
        <td>${t.title}</td>
        <td>${t.status}</td>
        <td>${t.priority}</td>
        <td>${profiles.find((p) => p.id === t.assigned_to)?.full_name ?? '—'}</td>
        <td>${fmtDate(t.due_date)}</td>
        <td>${t.completion}%</td>
      </tr>`
    )
    .join('');
  win.document.write(`
    <html><head><title>Task Report</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px} h1{font-size:20px} table{width:100%;border-collapse:collapse;margin-top:16px} th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px} th{background:#2563eb;color:#fff}</style>
    </head><body>
    <h1>Task Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <table><thead><tr><th>Title</th><th>Status</th><th>Priority</th><th>Assigned</th><th>Due Date</th><th>Completion</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <script>setTimeout(()=>window.print(),300)</script>
    </body></html>`);
  win.document.close();
}

export async function importTasks(file: File): Promise<Partial<Task>[]> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  return rows.map((r) => ({
    title: String(r.Title ?? r.title ?? ''),
    description: String(r.Description ?? r.description ?? ''),
    status: String(r.Status ?? r.status ?? 'backlog') as Task['status'],
    priority: String(r.Priority ?? r.priority ?? 'medium') as Task['priority'],
    completion: Number(r.Completion ?? r.completion ?? 0),
    tags: String(r.Tags ?? r.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
  }));
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
