type Props = {
  visible: boolean;
};

export function PlanCanvasEmptyStateOverlay({ visible }: Props) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center">
      <p className="font-medium text-foreground text-sm">This level is empty.</p>
      <p className="text-muted text-xs">
        Press W to draw a wall, or insert the seed house from the Project menu.
      </p>
      <p className="text-muted text-[10px] mt-1">Use PageUp / PageDown to switch levels.</p>
    </div>
  );
}
