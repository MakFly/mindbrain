const BASE_URL = '/api';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // Get API key from localStorage
  const apiKey = localStorage.getItem('mindbrain-api-key');
  if (apiKey) headers['X-API-Key'] = apiKey;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface Note {
  id: string;
  projectId: string;
  title: string;
  content: string;
  type: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface Edge {
  id: string;
  sourceId: string;
  targetId: string | null;
  type: string;
  label: string;
}

export interface GraphResult {
  nodes: Note[];
  edges: Edge[];
}

export interface SourceStat {
  source: string;
  count: number;
  last_import: number;
}

export const api = {
  // Notes
  listNotes: (params?: { type?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.limit) qs.set('limit', String(params.limit));
    return request<Note[]>('GET', `/notes?${qs}`);
  },

  getNote: (id: string) => request<Note>('GET', `/notes/${id}`),

  searchNotes: async (q: string, type?: string) => {
    const qs = new URLSearchParams({ q });
    if (type) qs.set('type', type);
    const data = await request<{ results: Note[]; count: number }>('GET', `/search?${qs}`);
    return data.results;
  },

  // Graph
  getGraph: (depth?: number) => {
    const qs = new URLSearchParams();
    if (depth) qs.set('depth', String(depth));
    return request<GraphResult>('GET', `/graph?${qs}`);
  },

  // Sources
  getSources: () => request<SourceStat[]>('GET', '/sources'),

  // Import
  importFrom: (source: string, path: string, dryRun?: boolean) =>
    request<{ imported: number; skipped: number; errors: number }>('POST', '/import', {
      source,
      path,
      dryRun,
    }),

  // Mine
  mine: (data: { platform?: string; since?: string; dryRun?: boolean }) =>
    request<{ saved: number; skipped: number; candidates: number }>('POST', '/mining', data),

  // Write operations
  createNote: (data: { title: string; content: string; type: string; tags: string[] }) =>
    request<Note>('POST', '/notes', data),

  updateNote: (id: string, data: Partial<{ title: string; content: string; type: string; tags: string[] }>) =>
    request<Note>('PUT', `/notes/${id}`, data),

  deleteNote: (id: string) =>
    request<void>('DELETE', `/notes/${id}`),

  // Graph actions
  autoLink: () =>
    request<{ created: number; skipped: number }>('POST', '/graph/auto-link'),

  // Project stats
  getStats: () =>
    request<{ notes: number; edges: number; sources: number }>('GET', '/projects/stats'),
};
