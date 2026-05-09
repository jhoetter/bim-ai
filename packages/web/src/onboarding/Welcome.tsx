import { useEffect } from 'react';
import { Btn } from '@bim-ai/ui';

const KEY = 'bim.welcome.dismissed';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onRoomRectTool: () => void;
};

export function Welcome({ visible, onDismiss, onRoomRectTool }: Props) {
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, onDismiss]);

  if (!visible) return null;

  function dismiss(permanent: boolean) {
    if (permanent) {
      try {
        localStorage.setItem(KEY, '1');
      } catch {
        /* noop */
      }
    }

    onDismiss();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to BIM AI"
      className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4"
    >
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <h2 className="text-xl font-semibold">Welcome to BIM AI</h2>

        <p className="mt-2 text-sm text-muted">
          Keyboard-first authoring: draw on plan, verify in 3D. Press `?` for shortcuts.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Btn type="button" onClick={() => onRoomRectTool()}>
            Sketch a room rectangle
          </Btn>

          <Btn type="button" variant="quiet" onClick={() => dismiss(false)}>
            Continue
          </Btn>

          <Btn type="button" variant="quiet" onClick={() => dismiss(true)}>
            Got it · don&apos;t show again
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function shouldShowWelcome(): boolean {
  try {
    return !localStorage.getItem(KEY);
  } catch {
    return true;
  }
}
