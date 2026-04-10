import { useEffect, useState, useCallback } from 'react';
import { api, type SourceStat } from '../lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UploadIcon, PickaxeIcon } from 'lucide-react';
import { useSSEContext } from '../contexts/sse-context';

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

const IMPORT_SOURCES = ['flat-files', 'claude-mem', 'mempalace', 'cursor-rules'];
const MINE_PLATFORMS = ['auto', 'claude-code', 'cursor', 'codex', 'gemini'];

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

interface MineResult {
  saved: number;
  skipped: number;
  candidates: number;
}

export function SourcesView() {
  const sse = useSSEContext();
  const [sources, setSources] = useState<SourceStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Import form
  const [importSource, setImportSource] = useState('flat-files');
  const [importPath, setImportPath] = useState('');
  const [importDryRun, setImportDryRun] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState('');

  // Mine form
  const [minePlatform, setMinePlatform] = useState('auto');
  const [mineDryRun, setMineDryRun] = useState(false);
  const [mineLoading, setMineLoading] = useState(false);
  const [mineResult, setMineResult] = useState<MineResult | null>(null);
  const [mineError, setMineError] = useState('');

  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getSources();
      setSources(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Failed to load sources:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSources();
  }, [loadSources]);

  const handleImportCompleted = useCallback((data: unknown) => {
    const result = data as { imported?: number; skipped?: number } | null;
    if (result && typeof result.imported === 'number') {
      toast.success(`Import: ${result.imported} imported, ${result.skipped ?? 0} skipped`);
    } else {
      toast.success('Import completed');
    }
    void loadSources();
  }, [loadSources]);

  const handleMiningCompleted = useCallback((data: unknown) => {
    const result = data as { saved?: number; skipped?: number; candidates?: number } | null;
    if (result && typeof result.saved === 'number') {
      toast.success(`Mining: ${result.saved} saved, ${result.skipped ?? 0} skipped`);
    } else {
      toast.success('Mining completed');
    }
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    sse.on('import:completed', handleImportCompleted);
    sse.on('mining:completed', handleMiningCompleted);
    return () => {
      sse.off('import:completed', handleImportCompleted);
      sse.off('mining:completed', handleMiningCompleted);
    };
  }, [sse, handleImportCompleted, handleMiningCompleted]);

  async function handleImport() {
    if (!importPath.trim()) {
      setImportError('Path is required.');
      return;
    }
    setImportLoading(true);
    setImportError('');
    setImportResult(null);
    try {
      const result = await api.importFrom(importSource, importPath.trim(), importDryRun);
      setImportResult(result);
      if (!importDryRun) {
        toast.success(`Imported ${result.imported} notes`);
        void loadSources();
      } else {
        toast.info(`Dry run: would import ${result.imported} notes`);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    }
    setImportLoading(false);
  }

  async function handleMine() {
    setMineLoading(true);
    setMineError('');
    setMineResult(null);
    try {
      const result = await api.mine({
        platform: minePlatform === 'auto' ? undefined : minePlatform,
        dryRun: mineDryRun,
      });
      setMineResult(result);
      if (!mineDryRun) {
        toast.success(`Mined ${result.saved} notes from ${result.candidates} candidates`);
        void loadSources();
      } else {
        toast.info(`Dry run: found ${result.candidates} candidates, would save ${result.saved}`);
      }
    } catch (err) {
      setMineError(err instanceof Error ? err.message : 'Mining failed');
    }
    setMineLoading(false);
  }

  const allSources = Object.keys(SOURCE_INFO);

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <div>
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
      </div>

      {/* Import action */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UploadIcon className="h-4 w-4" />
            Import from Source
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="import-source">Source</Label>
              <Select value={importSource} onValueChange={setImportSource}>
                <SelectTrigger id="import-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORT_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{SOURCE_INFO[s]?.label ?? s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="import-path">Path</Label>
              <Input
                id="import-path"
                value={importPath}
                onChange={(e) => setImportPath(e.target.value)}
                placeholder="e.g. ~/.claude"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="import-dryrun"
              type="checkbox"
              checked={importDryRun}
              onChange={(e) => setImportDryRun(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="import-dryrun" className="cursor-pointer font-normal">
              Dry run (preview only, no changes)
            </Label>
          </div>

          {importError && <p className="text-sm text-destructive">{importError}</p>}

          {importResult && (
            <div className="text-sm rounded-md bg-muted px-3 py-2 flex gap-4">
              <span><span className="font-medium text-green-700">{importResult.imported}</span> imported</span>
              <span><span className="font-medium text-muted-foreground">{importResult.skipped}</span> skipped</span>
              {importResult.errors > 0 && (
                <span><span className="font-medium text-destructive">{importResult.errors}</span> errors</span>
              )}
              {importDryRun && <span className="text-muted-foreground italic">(dry run)</span>}
            </div>
          )}

          <Button onClick={() => void handleImport()} disabled={importLoading}>
            {importLoading ? 'Importing...' : 'Import'}
          </Button>
        </CardContent>
      </Card>

      {/* Mine conversations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PickaxeIcon className="h-4 w-4" />
            Mine Conversations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-56 space-y-1">
            <Label htmlFor="mine-platform">Platform</Label>
            <Select value={minePlatform} onValueChange={setMinePlatform}>
              <SelectTrigger id="mine-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINE_PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="mine-dryrun"
              type="checkbox"
              checked={mineDryRun}
              onChange={(e) => setMineDryRun(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="mine-dryrun" className="cursor-pointer font-normal">
              Dry run (preview only, no changes)
            </Label>
          </div>

          {mineError && <p className="text-sm text-destructive">{mineError}</p>}

          {mineResult && (
            <div className="text-sm rounded-md bg-muted px-3 py-2 flex gap-4">
              <span><span className="font-medium">{mineResult.candidates}</span> candidates found</span>
              <span><span className="font-medium text-green-700">{mineResult.saved}</span> saved</span>
              <span><span className="font-medium text-muted-foreground">{mineResult.skipped}</span> skipped</span>
              {mineDryRun && <span className="text-muted-foreground italic">(dry run)</span>}
            </div>
          )}

          <Button onClick={() => void handleMine()} disabled={mineLoading}>
            {mineLoading ? 'Mining...' : 'Mine Conversations'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
