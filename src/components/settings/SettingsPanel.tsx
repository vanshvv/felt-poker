import { useRef, useState } from 'react';
import { useGameStore, selectPhase } from '@/store/useGameStore';
import { Chip, Field } from '@/components/common/ui';
import { useFmt } from '@/components/common/useFmt';

export function SettingsPanel() {
  const settings = useGameStore((s) => s.settings);
  const update = useGameStore((s) => s.updateSettings);
  const exportSession = useGameStore((s) => s.exportSession);
  const importSession = useGameStore((s) => s.importSession);
  const resetSession = useGameStore((s) => s.resetSession);
  const phase = useGameStore(selectPhase);
  const { fmt } = useFmt();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState<null | 'keep' | 'full'>(null);

  const liveHand = phase === 'betting' || phase === 'street-end' || phase === 'showdown';

  const doExport = () => {
    const blob = new Blob([exportSession()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `felt-session-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importSession(JSON.parse(String(reader.result)));
      } catch {
        importSession(null);
      }
    };
    reader.readAsText(file);
  };

  const setDenom = (i: number, patch: Partial<{ value: number; color: string }>) => {
    const next = settings.chipDenominations.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
    update({ chipDenominations: next });
  };
  const addDenom = () =>
    update({
      chipDenominations: [...settings.chipDenominations, { value: 2000, color: '#4b8f7d' }].sort(
        (a, b) => a.value - b.value,
      ),
    });
  const removeDenom = (i: number) =>
    update({ chipDenominations: settings.chipDenominations.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      {liveHand && (
        <div className="glass rounded-xl px-3 py-2 text-xs text-[var(--muted)]">
          Blind &amp; stake changes apply to the next hand.
        </div>
      )}

      <section>
        <h3 className="font-display text-lg text-[var(--cream)] mb-3">Stakes</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Small blind">
            <Num value={settings.smallBlind} onChange={(v) => update({ smallBlind: v })} />
          </Field>
          <Field label="Big blind">
            <Num value={settings.bigBlind} onChange={(v) => update({ bigBlind: v })} />
          </Field>
          <Field label="Ante">
            <Num value={settings.ante} onChange={(v) => update({ ante: v })} />
          </Field>
          <Field label="Default rebuy">
            <Num value={settings.defaultRebuy} onChange={(v) => update({ defaultRebuy: v })} />
          </Field>
          <Field label="Currency">
            <input
              className="chip-input"
              maxLength={3}
              value={settings.currency}
              onChange={(e) => update({ currency: e.target.value })}
            />
          </Field>
          <Field label="Starting buy-in">
            <Num value={settings.startingBuyIn} onChange={(v) => update({ startingBuyIn: v })} />
          </Field>
        </div>
      </section>

      <section>
        <label className="flex items-center justify-between glass rounded-xl px-3.5 py-2.5 cursor-pointer">
          <span className="text-sm">Auto-rotate dealer each hand</span>
          <input
            type="checkbox"
            checked={settings.autoRotateDealer}
            onChange={(e) => update({ autoRotateDealer: e.target.checked })}
            className="w-5 h-5 accent-[var(--gold)]"
          />
        </label>
        <div className="text-[0.66rem] text-[var(--muted-2)] mt-1 px-1">
          Odd chips in split pots go to the winner closest to the left of the button.
        </div>
      </section>

      <section>
        <h3 className="font-display text-lg text-[var(--cream)] mb-3">Chip denominations</h3>
        <div className="space-y-2">
          {settings.chipDenominations.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <Chip color={d.color} size={30} label={d.value} />
              <input
                type="number"
                className="chip-input tnum flex-1"
                value={d.value}
                onChange={(e) => setDenom(i, { value: parseInt(e.target.value, 10) || 0 })}
              />
              <input
                type="color"
                value={d.color}
                onChange={(e) => setDenom(i, { color: e.target.value })}
                className="w-9 h-9 rounded-lg bg-transparent border hair cursor-pointer"
              />
              <button className="btn btn-ghost !px-2.5" onClick={() => removeDenom(i)} aria-label="Remove">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost text-sm mt-2" onClick={addDenom}>
          + Add denomination
        </button>
        <div className="text-[0.66rem] text-[var(--muted-2)] mt-1">
          Purely visual — the ledger always works on exact {fmt(1)}-level amounts.
        </div>
      </section>

      <section>
        <h3 className="font-display text-lg text-[var(--cream)] mb-3">Session</h3>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-ghost" onClick={doExport}>
            ⬇ Export
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            ⬆ Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = '';
            }}
          />
        </div>

        <div className="mt-3">
          {confirmReset ? (
            <div className="glass rounded-xl p-3">
              <div className="text-sm mb-2">
                {confirmReset === 'keep'
                  ? 'Start a fresh session, resetting all stacks to their buy-ins?'
                  : 'Erase everything — players, hands and ledger?'}
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-danger flex-1"
                  onClick={() => {
                    resetSession(confirmReset === 'keep');
                    setConfirmReset(null);
                  }}
                >
                  Confirm
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmReset(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-ghost" disabled={liveHand} onClick={() => setConfirmReset('keep')}>
                New session
              </button>
              <button
                className="btn btn-ghost text-[var(--loss)]"
                disabled={liveHand}
                onClick={() => setConfirmReset('full')}
              >
                Reset everything
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Num({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      className="chip-input tnum"
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
    />
  );
}
