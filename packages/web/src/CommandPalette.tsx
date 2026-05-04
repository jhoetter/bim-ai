import { Command } from 'cmdk';
import { useEffect } from 'react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: {
    id: string;
    label: string;
    kbd?: string;
    onSelect: () => void;
  }[];
};

export function CommandPalette(props: Props) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        props.onOpenChange(!props.open);
      }
      if (ev.key === 'Escape') props.onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props, props.open]);

  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 backdrop-blur-sm"
        aria-label="Close command palette"
        onClick={() => props.onOpenChange(false)}
      />
      <div className="relative mx-auto mt-24 max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
        <Command className="p-2" label="Commands">
          <Command.Input
            autoFocus
            placeholder="Type a command…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none"
          />
          <Command.List className="mt-2 max-h-80 overflow-auto px-1 pb-1">
            <Command.Empty className="px-3 py-2 text-sm text-muted">No matches.</Command.Empty>
            <Command.Group heading="BIM AI">
              {props.actions.map((a) => (
                <Command.Item
                  key={a.id}
                  value={`${a.id} ${a.label}`}
                  onSelect={() => {
                    a.onSelect();
                    props.onOpenChange(false);
                  }}
                  className="cursor-pointer rounded-md px-3 py-2 text-sm hover:bg-accent/15"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span>{a.label}</span>

                    {a.kbd ? (
                      <span className="rounded bg-background px-2 py-0.5 font-mono text-[11px] text-muted ring-1 ring-border">
                        {a.kbd}
                      </span>
                    ) : null}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
