import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { formatMoney } from '@/lib/poker';
import { SAMPLE_NAMES } from '@/lib/constants';
import { Field } from '@/components/common/ui';

export function SetupScreen() {
  const settings = useGameStore((s) => s.settings);
  const players = useGameStore((s) => s.players);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const addPlayer = useGameStore((s) => s.addPlayer);
  const removePlayer = useGameStore((s) => s.removePlayer);
  const beginSession = useGameStore((s) => s.beginSession);

  const [name, setName] = useState('');
  const [buyIn, setBuyIn] = useState(settings.startingBuyIn);

  const cur = settings.currency;
  const canStart = players.filter((p) => p.cashedOut == null).length >= 2;

  const add = () => {
    const nm = name.trim() || SAMPLE_NAMES[players.length % SAMPLE_NAMES.length];
    addPlayer({ name: nm, buyIn });
    setName('');
    setBuyIn(settings.startingBuyIn);
  };

  return (
    <div className="min-h-full w-full flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl">
        <header className="text-center mb-7">
          <div className="inline-flex items-center gap-3 mb-2">
            <span className="text-3xl">♠</span>
            <h1 className="font-display text-4xl md:text-5xl text-[var(--cream)] tracking-tight">Felt</h1>
            <span className="text-3xl">♦</span>
          </div>
          <p className="text-[var(--muted)] text-sm md:text-base">
            Poker table &amp; chip simulator — you bring the cards, Felt handles the chips, pots and
            money.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Blinds & stakes */}
          <section className="glass rounded-2xl p-5">
            <h2 className="font-display text-xl text-[var(--cream)] mb-4">Table &amp; Stakes</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Small blind">
                <NumberBox value={settings.smallBlind} onChange={(v) => updateSettings({ smallBlind: v })} />
              </Field>
              <Field label="Big blind">
                <NumberBox value={settings.bigBlind} onChange={(v) => updateSettings({ bigBlind: v })} />
              </Field>
              <Field label="Starting buy-in">
                <NumberBox
                  value={settings.startingBuyIn}
                  onChange={(v) => updateSettings({ startingBuyIn: v, defaultRebuy: v })}
                />
              </Field>
              <Field label="Ante (optional)">
                <NumberBox value={settings.ante} onChange={(v) => updateSettings({ ante: v })} />
              </Field>
              <Field label="Currency symbol">
                <input
                  className="chip-input"
                  value={settings.currency}
                  maxLength={3}
                  onChange={(e) => updateSettings({ currency: e.target.value })}
                />
              </Field>
              <Field label="Max seats">
                <NumberBox
                  value={settings.maxSeats}
                  min={2}
                  max={10}
                  onChange={(v) => updateSettings({ maxSeats: Math.max(2, Math.min(10, v)) })}
                />
              </Field>
            </div>
            <div className="mt-4 text-xs text-[var(--muted)]">
              No-Limit Texas Hold’em · {formatMoney(settings.smallBlind, cur)} /{' '}
              {formatMoney(settings.bigBlind, cur)}
              {settings.ante > 0 && <> · ante {formatMoney(settings.ante, cur)}</>}
            </div>
          </section>

          {/* Players */}
          <section className="glass rounded-2xl p-5 flex flex-col">
            <h2 className="font-display text-xl text-[var(--cream)] mb-4">
              Players <span className="text-[var(--muted)] text-sm">({players.length})</span>
            </h2>

            <div className="flex gap-2 mb-3">
              <input
                className="chip-input flex-1"
                placeholder={`Name — e.g. ${SAMPLE_NAMES[players.length % SAMPLE_NAMES.length]}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
              />
              <div className="w-28">
                <NumberBox value={buyIn} onChange={setBuyIn} prefix={cur} />
              </div>
              <button className="btn btn-gold" onClick={add}>
                Add
              </button>
            </div>

            <div className="flex-1 space-y-2 min-h-[140px]">
              {players.length === 0 && (
                <div className="text-sm text-[var(--muted-2)] text-center py-8">
                  Add at least two players to begin.
                </div>
              )}
              {players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 anim-rise"
                  style={{ background: 'rgba(0,0,0,0.22)' }}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ background: p.color, boxShadow: `0 0 10px ${p.color}66` }}
                  />
                  <span className="flex-1 font-medium truncate">{p.name}</span>
                  <span className="tnum text-sm text-[var(--gold-soft)]">
                    {formatMoney(p.buyIns, cur)}
                  </span>
                  <button
                    className="btn btn-ghost !px-2 !py-1 text-xs"
                    onClick={() => removePlayer(p.id)}
                    aria-label={`Remove ${p.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <button
                className="btn btn-ghost text-xs"
                onClick={() =>
                  addPlayer({
                    name: SAMPLE_NAMES[players.length % SAMPLE_NAMES.length],
                    buyIn: settings.startingBuyIn,
                  })
                }
              >
                + Quick add
              </button>
            </div>
          </section>
        </div>

        <div className="flex flex-col items-center mt-7 gap-3">
          <button
            className="btn btn-gold btn-lg px-10"
            disabled={!canStart}
            onClick={beginSession}
          >
            ♠ Start Session
          </button>
          {!canStart && (
            <span className="text-xs text-[var(--muted-2)]">Add two or more players to start.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function NumberBox({
  value,
  onChange,
  min = 0,
  max,
  prefix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  prefix?: string;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        className="chip-input"
        style={{ paddingLeft: prefix ? '1.6rem' : undefined }}
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          onChange(Number.isNaN(v) ? 0 : v);
        }}
      />
    </div>
  );
}
