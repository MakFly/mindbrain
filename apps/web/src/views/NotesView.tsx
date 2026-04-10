import { useEffect, useState, useCallback } from 'react';
import { api, type Note } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchIcon, PlusIcon, PencilIcon, TrashIcon } from 'lucide-react';
import { useSSEContext } from '../App';

type TypeColor = 'default' | 'secondary' | 'destructive' | 'outline';

const TYPE_BADGE_VARIANT: Record<string, TypeColor> = {
  user: 'default',
  feedback: 'secondary',
  project: 'outline',
  reference: 'secondary',
  codebase: 'outline',
  debug: 'destructive',
};

const TYPE_COLORS_INLINE: Record<string, string> = {
  user: 'bg-green-500/10 text-green-700 border-green-500/20',
  feedback: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  project: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  reference: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  codebase: 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20',
  debug: 'bg-red-500/10 text-red-700 border-red-500/20',
};

const NOTE_TYPES = ['all', 'user', 'feedback', 'project', 'reference', 'codebase', 'debug'];
const NOTE_TYPE_OPTIONS = ['user', 'feedback', 'project', 'reference', 'codebase', 'debug'];

interface NoteFormData {
  title: string;
  type: string;
  tags: string;
  content: string;
}

const emptyForm = (): NoteFormData => ({
  title: '',
  type: 'user',
  tags: '',
  content: '',
});

function noteToForm(note: Note): NoteFormData {
  return {
    title: note.title,
    type: note.type,
    tags: note.tags.join(', '),
    content: note.content,
  };
}

export function NotesView() {
  const sse = useSSEContext();
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<NoteFormData>(emptyForm());
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<NoteFormData>(emptyForm());
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    void loadNotes();
  }, [typeFilter]);

  const handleNoteCreated = useCallback((data: unknown) => {
    const note = data as { title?: string };
    toast.info(`Note added${note?.title ? `: ${note.title}` : ''}`);
    void loadNotes();
  }, []);

  const handleNoteUpdated = useCallback(() => {
    toast.info('Note updated');
    void loadNotes();
  }, []);

  const handleNoteDeleted = useCallback(() => {
    toast.info('Note deleted');
    void loadNotes();
  }, []);

  useEffect(() => {
    sse.on('note:created', handleNoteCreated);
    sse.on('note:updated', handleNoteUpdated);
    sse.on('note:deleted', handleNoteDeleted);
    return () => {
      sse.off('note:created', handleNoteCreated);
      sse.off('note:updated', handleNoteUpdated);
      sse.off('note:deleted', handleNoteDeleted);
    };
  }, [sse, handleNoteCreated, handleNoteUpdated, handleNoteDeleted]);

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

  async function handleCreate() {
    if (!createForm.title.trim()) {
      setCreateError('Title is required.');
      return;
    }
    setCreateLoading(true);
    setCreateError('');
    try {
      const tags = createForm.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await api.createNote({
        title: createForm.title.trim(),
        content: createForm.content,
        type: createForm.type,
        tags,
      });
      setCreateOpen(false);
      setCreateForm(emptyForm());
      toast.success('Note created');
      void loadNotes();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create note');
    }
    setCreateLoading(false);
  }

  function startEdit() {
    if (!selected) return;
    setEditForm(noteToForm(selected));
    setEditError('');
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setEditError('');
  }

  async function handleUpdate() {
    if (!selected) return;
    if (!editForm.title.trim()) {
      setEditError('Title is required.');
      return;
    }
    setEditLoading(true);
    setEditError('');
    try {
      const tags = editForm.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const updated = await api.updateNote(selected.id, {
        title: editForm.title.trim(),
        content: editForm.content,
        type: editForm.type,
        tags,
      });
      setSelected(updated);
      setEditMode(false);
      toast.success('Note saved');
      void loadNotes();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save note');
    }
    setEditLoading(false);
  }

  async function handleDelete() {
    if (!selected) return;
    setDeleteLoading(true);
    try {
      await api.deleteNote(selected.id);
      setDeleteOpen(false);
      setSelected(null);
      setEditMode(false);
      toast.success('Note deleted');
      void loadNotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete note');
    }
    setDeleteLoading(false);
  }

  return (
    <div className="flex h-full">
      {/* List panel */}
      <div className="w-96 border-r flex flex-col">
        <div className="p-4 border-b space-y-3">
          <div className="flex gap-2">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
              placeholder="Search notes..."
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={() => void handleSearch()}>
              <SearchIcon className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setCreateForm(emptyForm());
                setCreateError('');
                setCreateOpen(true);
              }}
              title="New Note"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {NOTE_TYPES.map((t) => (
              <Badge
                key={t}
                variant={typeFilter === t ? 'default' : 'outline'}
                className="cursor-pointer select-none"
                onClick={() => setTypeFilter(t)}
              >
                {t}
              </Badge>
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
                onClick={() => {
                  setSelected(note);
                  setEditMode(false);
                }}
                className={`w-full text-left p-3 border-b hover:bg-accent/50 transition-colors ${
                  selected?.id === note.id ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-1.5 py-0.5 text-[10px] rounded border ${TYPE_COLORS_INLINE[note.type] ?? ''}`}
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

      {/* Detail panel */}
      <div className="flex-1 overflow-auto p-6">
        {selected ? (
          editMode ? (
            /* Edit mode */
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-lg">Edit Note</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={cancelEdit} disabled={editLoading}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => void handleUpdate()} disabled={editLoading}>
                      {editLoading ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
                {editError && (
                  <p className="text-sm text-destructive">{editError}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    id="edit-title"
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-type">Type</Label>
                  <Select
                    value={editForm.type}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, type: v }))}
                  >
                    <SelectTrigger id="edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NOTE_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                  <Input
                    id="edit-tags"
                    value={editForm.tags}
                    onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-content">Content</Label>
                  <textarea
                    id="edit-content"
                    value={editForm.content}
                    onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
                    rows={12}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y font-mono"
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            /* View mode */
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3 mb-1">
                  <Badge
                    variant={TYPE_BADGE_VARIANT[selected.type] ?? 'outline'}
                    className={TYPE_COLORS_INLINE[selected.type]}
                  >
                    {selected.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(selected.updatedAt).toLocaleString()}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEdit} title="Edit">
                      <PencilIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                      title="Delete"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-xl">{selected.title}</CardTitle>
                {selected.tags.length > 0 && (
                  <div className="flex gap-2 flex-wrap pt-1">
                    {selected.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  Created {new Date(selected.createdAt).toLocaleString()} | ID: {selected.id.slice(0, 8)}
                </p>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{selected.content}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a note to view
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            <div className="space-y-1">
              <Label htmlFor="create-title">Title *</Label>
              <Input
                id="create-title"
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Note title"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-type">Type</Label>
              <Select
                value={createForm.type}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger id="create-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-tags">Tags (comma-separated)</Label>
              <Input
                id="create-tags"
                value={createForm.tags}
                onChange={(e) => setCreateForm((f) => ({ ...f, tags: e.target.value }))}
                placeholder="tag1, tag2, tag3"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-content">Content</Label>
              <textarea
                id="create-content"
                value={createForm.content}
                onChange={(e) => setCreateForm((f) => ({ ...f, content: e.target.value }))}
                rows={8}
                placeholder="Note content (Markdown supported)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createLoading}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={createLoading}>
              {createLoading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">"{selected?.title}"</span>?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
