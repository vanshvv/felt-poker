import { useMemo, useState } from 'react';
import type { HandState, Player, PlayerId } from '@/types';
import { distributePot, seatOrderFromButton, type ShowdownSelection } from '@/lib/poker';
import { useFmt } from '@/components/common/useFmt';

export function ShowdownPanel({
  hand,
  players,
  onFinalize,
}: {
  hand: HandState;
  players: Player[];
  onFinalize: (selections: ShowdownSelection[]) => void;
}) {
  const { fmt } = useFmt();
  const nameOf = (id: PlayerId) => players.find((p) => p.id === id)?.name ?? '—';
  const colorOf = (id: PlayerId) => players.find((p) => p.id === id)?.color ?? '#888';

  const order = useMemo(
    () => seatOrderFromButton(hand.players.map((p) => ({ id: p.id, seat: p.seat })), hand.buttonSeat),
    [hand],
  );

  const [sel, setSel] = useState<Record<string, PlayerId[]>>(() =>
    Object.fromEntries(hand.pots.map((p) => [p.id, []])),
  );

  const contenders = hand.players.filter((p) => p.status !== 'folded');

  const toggle = (potId: string, pid: PlayerId) =>
    setSel((s) => {
      const cur = s[potId] ?? [];
      return { ...s, [potId]: cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid] };
    });

  const winnerTakesAll = (pid: PlayerId) =>
    setSel(() =>
      Object.fromEntries(
        hand.pots.map((p) => [p.id, p.eligible.includes(pid) ? [pid] : []]),
      ),
    );

  const ready = hand.pots.every((p) => (sel[p.id] ?? []).length > 0);

  const confirm = () => {
    if (!ready) return;
    onFinalize(hand.pots.map((p) => ({ potId: p.id, winnerIds: sel[p.id] })));
  };

  return (
    <div className="w-full">
      <div className="text-center mb-3">
        <div className="font-display text-xl text-[var(--cream)]">Showdown — who won?</div>
        <div className="text-xs text-[var(--muted)]">
          Reveal the physical cards, then pick the winner of each pot.
        </div>
      </div>

      {hand.pots.length > 1 && (
        <div className="mb-3">
          <div className="text-[0.66rem] uppercase tracking-wider text-[var(--muted)] mb-1.5 text-center">
            Quick: winner takes everything
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {contenders.map((c) => (
              <button key={c.id} className="btn !py-1.5 text-sm" onClick={() => winnerTakesAll(c.id)}>
                <span className="w-2 h-2 rounded-full" style={{ background: colorOf(c.id) }} />
                {nameOf(c.id)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2.5 max-h-[42vh] overflow-y-auto scroll-thin">
        {hand.pots.map((pot, i) => {
          const winners = sel[pot.id] ?? [];
          const preview = winners.length
            ? distributePot(pot, winners, order).winners
            : [];
          return (
            <div key={pot.id} className="glass rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">
                  {i === 0 ? 'Main Pot' : `Side Pot ${i}`}{' '}
                  <span className="tnum text-[var(--gold-soft)]">{fmt(pot.amount)}</span>
                </span>
                {winners.length > 1 && (
                  <span className="text-[0.66rem] text-[var(--muted)]">split {winners.length} ways</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pot.eligible.map((pid) => {
                  const on = winners.includes(pid);
                  const amt = preview.find((w) => w.playerId === pid)?.amount;
                  return (
                    <button
                      key={pid}
                      onClick={() => toggle(pot.id, pid)}
                      className="btn !py-1.5 text-sm"
                      style={
                        on
                          ? { background: 'rgba(87,217,138,0.18)', borderColor: 'rgba(87,217,138,0.5)' }
                          : undefined
                      }
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: colorOf(pid) }} />
                      {nameOf(pid)}
                      {on && amt != null && (
                        <span className="tnum text-[var(--win)]">+{fmt(amt)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center mt-3">
        <button className="btn btn-gold btn-lg px-8" disabled={!ready} onClick={confirm}>
          Award pot{hand.pots.length > 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}
