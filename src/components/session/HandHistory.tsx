import { useState } from 'react';
import type { HandAction, HandHistoryEntry, Street } from '@/types';
import { useGameStore } from '@/store/useGameStore';
import { useFmt } from '@/components/common/useFmt';

const STREET_LABEL: Record<Street, string> = {
  preflop: 'Pre-Flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
  complete: 'Result',
};

export function HandHistory() {
  const history = useGameStore((s) => s.history);
  if (history.length === 0) {
    return <div className="text-sm text-[var(--muted-2)] text-center py-8">No hands played yet.</div>;
  }
  return (
    <div className="space-y-2">
      {[...history].reverse().map((h) => (
        <HandRow key={h.handNumber} hand={h} />
      ))}
    </div>
  );
}

function HandRow({ hand }: { hand: HandHistoryEntry }) {
  const { fmt } = useFmt();
  const [open, setOpen] = useState(false);
  const nameOf = (id: string) => hand.playerNames[id] ?? '—';
  const winners = hand.winners.map(nameOf).join(', ');

  const byStreet: Record<string, HandAction[]> = {};
  for (const a of hand.actions) {
    (byStreet[a.street] ??= []).push(a);
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left" onClick={() => setOpen((o) => !o)}>
        <span className="font-display text-lg text-[var(--cream)]">#{hand.handNumber}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">
            <span className="text-[var(--muted)]">won by </span>
            <span className="font-medium text-[var(--win)]">{winners || '—'}</span>
          </div>
          <div className="text-[0.66rem] text-[var(--muted-2)] tnum">
            Blinds {fmt(hand.smallBlind)}/{fmt(hand.bigBlind)}
            {hand.buttonPlayerId && <> · Dealer {nameOf(hand.buttonPlayerId)}</>}
          </div>
        </div>
        <span className="tnum text-[var(--gold-soft)] font-semibold">{fmt(hand.totalPot)}</span>
        <span className="text-[var(--muted)]">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-3.5 pb-3 border-t hair pt-2 space-y-2">
          {(['preflop', 'flop', 'turn', 'river'] as Street[]).map((st) =>
            byStreet[st] ? (
              <div key={st}>
                <div className="text-[0.62rem] uppercase tracking-wider text-[var(--gold-soft)] mb-1">
                  {STREET_LABEL[st]}
                </div>
                <div className="space-y-0.5">
                  {byStreet[st].map((a, i) => (
                    <div key={i} className="text-[0.8rem] text-[var(--muted)] flex gap-1.5">
                      <span className="text-[var(--ink)] font-medium">{nameOf(a.playerId)}</span>
                      <span>{describeAction(a, fmt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null,
          )}

          <div>
            <div className="text-[0.62rem] uppercase tracking-wider text-[var(--gold-soft)] mb-1">
              Result
            </div>
            {hand.awards.map((aw, i) => (
              <div key={i} className="text-[0.8rem]">
                <span className="text-[var(--muted)]">{aw.potLabel}: </span>
                {aw.winners.map((w, j) => (
                  <span key={j} className="text-[var(--win)]">
                    {j > 0 && ', '}
                    {nameOf(w.playerId)} +{fmt(w.amount)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function describeAction(a: HandAction, fmt: (n: number) => string): string {
  switch (a.type) {
    case 'post-sb':
      return `posts small blind ${fmt(a.amount)}`;
    case 'post-bb':
      return `posts big blind ${fmt(a.amount)}`;
    case 'post-ante':
      return `posts ante ${fmt(a.amount)}`;
    case 'fold':
      return 'folds';
    case 'check':
      return 'checks';
    case 'call':
      return `calls ${fmt(a.amount)}`;
    case 'bet':
      return `bets ${fmt(a.toAmount)}`;
    case 'raise':
      return `raises to ${fmt(a.toAmount)}`;
    case 'allin':
      return `is all-in ${fmt(a.toAmount)}`;
    default:
      return a.type;
  }
}
