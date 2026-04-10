import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NotesView } from './views/NotesView';
import { GraphView } from './views/GraphView';
import { SourcesView } from './views/SourcesView';
import { SettingsDialog } from './components/SettingsDialog';
import { AppSidebar } from './components/app-sidebar';
import { SidebarProvider } from './components/ui/sidebar';
import { Toaster } from './components/ui/sonner';
import { useState } from 'react';
import { useSSE } from './hooks/use-sse';
import { SSEContext } from './contexts/sse-context';

function AppInner() {
  const [settingsOpen, setSettingsOpen] = useState(!localStorage.getItem('mindbrain-api-key'));
  const sse = useSSE();

  return (
    <SSEContext.Provider value={sse}>
      <BrowserRouter>
        <SidebarProvider>
          <AppSidebar onSettingsOpen={() => setSettingsOpen(true)} connected={sse.connected} />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<NotesView />} />
              <Route path="/graph" element={<GraphView />} />
              <Route path="/sources" element={<SourcesView />} />
            </Routes>
          </main>
        </SidebarProvider>

        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        <Toaster />
      </BrowserRouter>
    </SSEContext.Provider>
  );
}

function App() {
  return <AppInner />;
}

export default App;
