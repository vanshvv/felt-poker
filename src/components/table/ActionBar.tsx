import { useMemo, useState } from 'react';
import type { HandState, Player, PlayerId } from '@/types';
import { legalActions, potsTotal, type ActionInput } from '@/lib/poker';
import { useFmt } from '@/components/common/useFmt';

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function ActionBar({
  hand,
  player,
  onAct,
}: {
  hand: HandState;
  player: Player;
  onAct: (a: ActionInput) => void;
}) {
  const { fmt } = useFmt();
  const legal = useMemo(() => legalActions(hand, player.id), [hand, player.id]);
  const [panel, setPanel] = useState<null | 'bet' | 'raise'>(null);

  if (!legal.yourTurn) return null;

  const openPanel = legal.canBet ? 'bet' : 'raise';

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-2 mb-2.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: player.color }} />
        <span className="font-semibold">{player.name}</span>
        <span className="text-[var(--muted)] text-sm tnum">to act · stack {fmt(legal.allInTo - (hand.players.find(p=>p.id===player.id)?.streetCommitted ?? 0))}</span>
      </div>

      {panel ? (
        <BetPanel
          hand={hand}
          playerId={player.id}
          mode={panel}
          onCancel={() => setPanel(null)}
          onConfirm={(amount) => {
            setPanel(null);
            onAct({ type: panel, amount });
          }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button className="btn btn-danger btn-lg" onClick={() => onAct({ type: 'fold' })}>
            Fold
          </button>

          {legal.canCheck ? (
            <button className="btn btn-lg" onClick={() => onAct({ type: 'check' })}>
              Check
            </button>
          ) : (
            <button className="btn btn-lg" disabled={!legal.canCall} onClick={() => onAct({ type: 'call' })}>
              {legal.callIsAllIn ? 'Call All-In' : 'Call'}
              <span className="tnum text-[var(--gold-soft)]">{fmt(legal.callAmount)}</span>
            </button>
          )}

          {legal.canBet || legal.canRaise ? (
            <button className="btn btn-gold btn-lg" onClick={() => setPanel(openPanel)}>
              {legal.canBet ? 'Bet' : 'Raise'}
            </button>
          ) : (
            <button className="btn btn-lg" disabled>
              Raise
            </button>
          )}

          <button
            className="btn btn-lg"
            style={{ borderColor: 'var(--panel-brd-strong)', color: 'var(--gold)' }}
            disabled={!legal.canAllIn}
            onClick={() => onAct({ type: 'allin' })}
          >
            All-In
            <span className="tnum text-sm">{fmt(legal.allInTo)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function BetPanel({
  hand,
  playerId,
  mode,
  onConfirm,
  onCancel,
}: {
  hand: HandState;
  playerId: PlayerId;
  mode: 'bet' | 'raise';
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}) {
  const { fmt } = useFmt();
  const legal = legalActions(hand, playerId);
  const me = hand.players.find((p) => p.id === playerId)!;
  const potNow = potsTotal(hand.pots);
  const toCall = Math.max(0, hand.currentBet - me.streetCommitted);
  const { minTo, maxTo } = legal;
  const [amount, setAmount] = useState(minTo);

  const fractionTo = (frac: number) =>
    clamp(hand.currentBet + Math.round(frac * (potNow + toCall)), minTo, maxTo);

  const quicks: { label: string; to: number }[] = [
    { label: 'Min', to: minTo },
    { label: '½ Pot', to: fractionTo(0.5) },
    { label: 'Pot', to: fractionTo(1) },
    { label: 'Max', to: maxTo },
  ];

  const value = clamp(amount, minTo, maxTo);
  const raiseBy = value - hand.currentBet;

  return (
    <div className="glass rounded-2xl p-3.5 anim-rise">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[var(--muted)]">
          {mode === 'bet' ? 'Bet to' : 'Raise to'}
        </span>
        <span className="tnum text-2xl font-bold text-[var(--gold-soft)]">{fmt(value)}</span>
      </div>

      <input
        type="range"
        min={minTo}
        max={maxTo}
        step={1}
        value={value}
        onChange={(e) => setAmount(parseInt(e.target.value, 10))}
        className="w-full accent-[var(--gold)]"
        style={{ accentColor: 'var(--gold)' }}
      />

      <div className="grid grid-cols-4 gap-2 mt-2.5">
        {quicks.map((q) => (
          <button
            key={q.label}
            className="btn !py-2 text-sm"
            style={value === q.to ? { borderColor: 'var(--panel-brd-strong)', color: 'var(--gold)' } : undefined}
            onClick={() => setAmount(q.to)}
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3">
        <input
          type="number"
          className="chip-input tnum"
          value={value}
          min={minTo}
          max={maxTo}
          onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
        />
        <button className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-gold px-6" onClick={() => onConfirm(value)}>
          {value >= maxTo && maxTo === legal.allInTo ? 'All-In' : mode === 'bet' ? 'Bet' : 'Raise'}
        </button>
      </div>
      <div className="text-[0.68rem] text-[var(--muted-2)] mt-1.5 tnum">
        min {fmt(minTo)} · raising by {fmt(Math.max(0, raiseBy))} · your all-in {fmt(legal.allInTo)}
      </div>
    </div>
  );
}
