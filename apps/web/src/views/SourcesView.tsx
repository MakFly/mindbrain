import { useEffect, useState } from 'react';
import { api, type SourceStat } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
              <Card key={source} className="transition-colors hover:bg-accent/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{info.label}</CardTitle>
                    {stat ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                        {stat.count} notes
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not imported</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{info.description}</p>
                  {stat && (
                    <p className="text-xs text-muted-foreground">
                      Last import: {new Date(stat.last_import).toLocaleString()}
                    </p>
                  )}
                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground mb-1">Import via CLI:</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded block font-mono">
                      mb import --from {source}
                    </code>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-8 bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quick Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Use the CLI to import from any source:
          </p>
          <div className="bg-background rounded border p-3 space-y-1 font-mono text-sm">
            <p>mb import --from flat-files ~/.claude</p>
            <p>mb import --from claude-mem ~/.claude-mem/db.sqlite</p>
            <p>mb import --from mempalace ~/.mempalace</p>
            <p>mb import --from cursor-rules ~/.cursor/rules</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
