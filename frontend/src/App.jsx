import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout/Layout.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import ProjectView from './components/ProjectView/ProjectView.jsx';
import NoteEditor from './components/NoteEditor/NoteEditor.jsx';
import SearchView from './components/Search/SearchView.jsx';
import SettingsPage from './components/Settings/SettingsPage.jsx';
import PipelinePage from './components/Pipeline/PipelinePage.jsx';
import LoginPage from './components/Login/LoginPage.jsx';

function AuthGate({ children }) {
  const { user } = useAuth();

  // Still checking session — show a neutral spinner (theme already applied)
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginPage />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AuthGate>
            <AppProvider>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="/projects/:projectId" element={<ProjectView />} />
                  <Route path="/projects/:projectId/notes/:noteId" element={<NoteEditor />} />
                  <Route path="/pipeline" element={<PipelinePage />} />
                  <Route path="/search" element={<SearchView />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Routes>
            </AppProvider>
          </AuthGate>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
