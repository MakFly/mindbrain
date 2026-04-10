import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { NotesView } from './views/NotesView';
import { GraphView } from './views/GraphView';
import { SourcesView } from './views/SourcesView';
import { SettingsDialog } from './components/SettingsDialog';
import { useState } from 'react';

function App() {
  const [settingsOpen, setSettingsOpen] = useState(!localStorage.getItem('mindbrain-api-key'));

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <aside className="w-56 border-r bg-muted/30 flex flex-col">
          <div className="p-4 border-b">
            <h1 className="text-lg font-bold tracking-tight">mindbrain</h1>
            <p className="text-xs text-muted-foreground">memory hub</p>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50'
                }`
              }
            >
              Notes
            </NavLink>
            <NavLink
              to="/graph"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50'
                }`
              }
            >
              Graph
            </NavLink>
            <NavLink
              to="/sources"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50'
                }`
              }
            >
              Sources
            </NavLink>
          </nav>
          <div className="p-2 border-t">
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 text-left"
            >
              Settings
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<NotesView />} />
            <Route path="/graph" element={<GraphView />} />
            <Route path="/sources" element={<SourcesView />} />
          </Routes>
        </main>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </BrowserRouter>
  );
}

export default App;
