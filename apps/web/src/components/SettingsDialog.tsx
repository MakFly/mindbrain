import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: Props) {
  const [apiKey, setApiKey] = useState(localStorage.getItem('mindbrain-api-key') || '');
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('mindbrain-api-url') || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-96">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="mb_..."
            />
            <p className="text-xs text-muted-foreground">
              Find it in your .mindbrain.json file
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="api-url">API URL</Label>
            <Input
              id="api-url"
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:3456"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for default (localhost:3456)
            </p>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                localStorage.setItem('mindbrain-api-key', apiKey);
                if (apiUrl) {
                  localStorage.setItem('mindbrain-api-url', apiUrl);
                } else {
                  localStorage.removeItem('mindbrain-api-url');
                }
                onOpenChange(false);
                window.location.reload();
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
