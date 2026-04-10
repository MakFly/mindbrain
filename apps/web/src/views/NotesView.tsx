import { useEffect, useState } from 'react';
import { api, type Note } from '../lib/api';
import ReactMarkdown from 'react-markdown';

const TYPE_COLORS: Record<string, string> = {
  user: 'bg-green-500/10 text-green-700 border-green-500/20',
  feedback: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  project: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  reference: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  codebase: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20',
  debug: 'bg-red-500/10 text-red-700 border-red-500/20',
};

const NOTE_TYPES = ['all', 'user', 'feedback', 'project', 'reference', 'codebase', 'debug'];

export function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadNotes();
  }, [typeFilter]);

  async function loadNotes() {
    setLoading(true);
    try {
      const params: { type?: string; limit?: number } = { limit: 200 };
      if (typeFilter !== 'all') params.type = typeFilter;
      const result = await api.listNotes(params);
      setNotes(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
    setLoading(false);
  }

  async function handleSearch() {
    if (!search.trim()) {
      void loadNotes();
      return;
    }
    setLoading(true);
    try {
      const result = await api.searchNotes(
        search,
        typeFilter !== 'all' ? typeFilter : undefined,
      );
      setNotes(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Search failed:', err);
    }
    setLoading(false);
  }

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="w-96 border-r flex flex-col">
        <div className="p-4 border-b space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
              placeholder="Search notes..."
              className="flex-1 px-3 py-1.5 border rounded-md text-sm bg-background"
            />
            <button
              onClick={() => void handleSearch()}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent"
            >
              Search
            </button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {NOTE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  typeFilter === t
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading...</p>
          ) : notes.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No notes found.</p>
          ) : (
            notes.map((note) => (
              <button
                key={note.id}
                onClick={() => setSelected(note)}
                className={`w-full text-left p-3 border-b hover:bg-accent/50 transition-colors ${
                  selected?.id === note.id ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-1.5 py-0.5 text-[10px] rounded border ${TYPE_COLORS[note.type] ?? ''}`}
                  >
                    {note.type}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm font-medium truncate">{note.title}</p>
                {note.tags.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {note.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] text-muted-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        <div className="p-2 border-t text-xs text-muted-foreground text-center">
          {notes.length} notes
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto p-6">
        {selected ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span
                className={`px-2 py-1 text-xs rounded border ${TYPE_COLORS[selected.type] ?? ''}`}
              >
                {selected.type}
              </span>
              <h2 className="text-xl font-semibold">{selected.title}</h2>
            </div>
            {selected.tags.length > 0 && (
              <div className="flex gap-2 mb-4">
                {selected.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 text-xs bg-muted rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground mb-6">
              Created {new Date(selected.createdAt).toLocaleString()} | Updated{' '}
              {new Date(selected.updatedAt).toLocaleString()} | ID: {selected.id.slice(0, 8)}
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{selected.content}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a note to view
          </div>
        )}
      </div>
    </div>
  );
}
