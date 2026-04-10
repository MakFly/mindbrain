import { useEffect, useState } from 'react';
import { api, type SourceStat } from '../lib/api';

const SOURCE_INFO: Record<string, { label: string; description: string }> = {
  'claude-mem': {
    label: 'Claude-Mem',
    description: 'Persistent memory plugin for Claude Code',
  },
  mempalace: {
    label: 'MemPalace',
    description: 'Palace-structured verbatim memory system',
  },
  'flat-files': {
    label: 'Flat Files',
    description: 'CLAUDE.md, MEMORY.md, rules/',
  },
  'cursor-rules': {
    label: 'Cursor Rules',
    description: '.cursor/rules/*.mdc files',
  },
};

export function SourcesView() {
  const [sources, setSources] = useState<SourceStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadSources();
  }, []);

  async function loadSources() {
    setLoading(true);
    try {
      const result = await api.getSources();
      setSources(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Failed to load sources:', err);
    }
    setLoading(false);
  }

  const allSources = Object.keys(SOURCE_INFO);

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-xl font-semibold mb-6">Import Sources</h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {allSources.map((source) => {
            const info = SOURCE_INFO[source]!;
            const stat = sources.find((s) => s.source === source);

            return (
              <div
                key={source}
                className="border rounded-lg p-4 hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{info.label}</h3>
                  {stat ? (
                    <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-700 rounded-full border border-green-500/20">
                      {stat.count} notes
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                      Not imported
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3">{info.description}</p>
                {stat && (
                  <p className="text-xs text-muted-foreground">
                    Last import: {new Date(stat.last_import).toLocaleString()}
                  </p>
                )}
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">
                    Import via CLI:{' '}
                    <code className="bg-muted px-1 rounded">mb import --from {source}</code>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 p-4 border rounded-lg bg-muted/30">
        <h3 className="font-medium mb-2">Quick Import</h3>
        <p className="text-sm text-muted-foreground mb-2">
          Use the CLI to import from any source:
        </p>
        <div className="space-y-1 text-sm font-mono bg-background p-3 rounded border">
          <p>mb import --from flat-files ~/.claude</p>
          <p>mb import --from claude-mem ~/.claude-mem/db.sqlite</p>
          <p>mb import --from mempalace ~/.mempalace</p>
          <p>mb import --from cursor-rules ~/.cursor/rules</p>
        </div>
      </div>
    </div>
  );
}
