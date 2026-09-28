import { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { SetupScreen } from './components/setup/SetupScreen';
import { TableScreen } from './components/table/TableScreen';

export function App() {
  const started = useGameStore((s) => s.started);
  return (
    <div className="h-full w-full">
      {started ? <TableScreen /> : <SetupScreen />}
      <ErrorToast />
    </div>
  );
}

function ErrorToast() {
  const error = useGameStore((s) => s.error);
  const clearError = useGameStore((s) => s.clearError);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 3600);
    return () => clearTimeout(t);
  }, [error, clearError]);
  if (!error) return null;
  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-1"
      style={{ animation: 'toast-in 0.2s ease-out' }}
      role="alert"
    >
      <div className="glass rounded-xl px-4 py-3 flex items-center gap-3 border !border-[rgba(255,107,107,0.4)] max-w-[92vw]">
        <span className="text-[var(--loss)] text-lg">⚠</span>
        <span className="text-sm text-[var(--ink)]">{error}</span>
        <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={clearError}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
