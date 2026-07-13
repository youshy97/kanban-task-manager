import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { useTasks, useProfiles } from './lib/hooks';
import { Layout } from './components/Layout';
import { AIAssistant } from './components/AIAssistant';
import { LoginPage, RegisterPage, ForgotPasswordPage } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { BoardPage } from './pages/BoardPage';
import { SearchPage } from './pages/SearchPage';
import { Analytics } from './pages/Analytics';
import { TeamPage } from './pages/TeamPage';
import { SettingsPage } from './pages/SettingsPage';
import { Spinner } from './components/ui';

function AppContent() {
  const { session, profile, loading } = useAuth();
  const { tasks, refresh: refreshTasks } = useTasks();
  const { profiles } = useProfiles();
  const [aiOpen, setAIOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="w-8 h-8 text-blue-600" />
          <p className="text-slate-500 text-sm">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!session || !profile) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <Layout onToggleAI={() => setAIOpen(!aiOpen)} aiOpen={aiOpen}>
        <Routes>
          <Route path="/app" element={<Dashboard tasks={tasks} profiles={profiles} />} />
          <Route path="/app/board" element={<BoardPage tasks={tasks} profiles={profiles} onChanged={refreshTasks} />} />
          <Route path="/app/search" element={<SearchPage tasks={tasks} profiles={profiles} onImported={refreshTasks} />} />
          <Route path="/app/analytics" element={<Analytics tasks={tasks} profiles={profiles} />} />
          <Route path="/app/team" element={<TeamPage profiles={profiles} tasks={tasks} onChanged={() => window.location.reload()} />} />
          <Route path="/app/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </Layout>
      <AIAssistant open={aiOpen} onClose={() => setAIOpen(false)} tasks={tasks} profiles={profiles} />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
