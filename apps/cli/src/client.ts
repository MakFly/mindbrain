import type { Note, Edge, GraphResult, Project, ImportResult } from "@mindbrain/shared";

interface CreateProjectResult {
  project: Project;
  apiKey: string;
}

interface SearchResult {
  results: Note[];
  count: number;
}

interface ContextResult {
  notes: Note[];
  markdown: string;
  count: number;
}

interface BacklinksResult {
  backlinks: Edge[];
  count: number;
}

interface MineResult {
  saved?: number;
  skipped?: number;
  conversationsParsed: number;
  platformsScanned: number;
  candidates?: {
    title: string;
    type: string;
    confidence: number;
    sourceContext: string;
    preview: string;
  }[];
}

export class MindbrainClient {
  constructor(
    private apiUrl: string,
    private apiKey: string,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    auth = true,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (auth) headers["X-API-Key"] = this.apiKey;

    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let msg = res.statusText;
      try {
        const err = (await res.json()) as { error?: string };
        if (err.error) msg = err.error;
      } catch {}
      throw new Error(`API ${res.status}: ${msg}`);
    }

    return res.json() as Promise<T>;
  }

  async createProject(name: string, path?: string) {
    return this.request<CreateProjectResult>(
      "POST",
      "/projects",
      { name, path },
      false,
    );
  }

  async createNote(data: {
    title: string;
    content: string;
    type: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }) {
    return this.request<Note>("POST", "/notes", data);
  }

  async getNote(id: string) {
    return this.request<Note>("GET", `/notes/${id}`);
  }

  async deleteNote(id: string) {
    return this.request<void>("DELETE", `/notes/${id}`);
  }

  async search(params: {
    q: string;
    tags?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }) {
    const qs = new URLSearchParams();
    qs.set("q", params.q);
    if (params.tags) qs.set("tags", params.tags);
    if (params.type) qs.set("type", params.type);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    return this.request<SearchResult>("GET", `/search?${qs}`);
  }

  async context(data: {
    files: string[];
    task: string;
    tags?: string[];
    type?: string;
    limit?: number;
  }) {
    return this.request<ContextResult>("POST", "/search/context", data);
  }

  async graph(params: { noteId?: string; depth?: number }) {
    const qs = new URLSearchParams();
    if (params.noteId) qs.set("noteId", params.noteId);
    if (params.depth) qs.set("depth", String(params.depth));
    return this.request<GraphResult>("GET", `/graph?${qs}`);
  }

  async backlinks(id: string) {
    return this.request<BacklinksResult>("GET", `/graph/notes/${id}/backlinks`);
  }

  async link(sourceId: string, targetId: string, type: string) {
    return this.request<{ edge: Edge }>("POST", `/graph/notes/${sourceId}/link`, {
      targetId,
      type,
    });
  }

  async updateNote(id: string, data: { title?: string; content?: string; type?: string; tags?: string[] }) {
    return this.request<Note>("PUT", `/notes/${id}`, data);
  }

  async listAllNotes(limit = 1000) {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    return this.request<Note[]>("GET", `/notes?${qs}`);
  }

  async importFrom(source: string, path: string, dryRun = false) {
    return this.request<ImportResult>("POST", "/import", { source, path, dryRun });
  }

  async mine(opts: {
    platform?: string;
    since?: string;
    dryRun?: boolean;
    llm?: boolean;
  }) {
    return this.request<MineResult>("POST", "/mining", opts);
  }

  async getSources() {
    return this.request<
      { source: string; count: number; last_import: number }[]
    >("GET", "/sources");
  }
}
