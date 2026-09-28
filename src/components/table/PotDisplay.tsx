import type { HandState } from '@/types';
import { potsTotal } from '@/lib/poker';
import { useFmt } from '@/components/common/useFmt';
import { ChipStackView } from '@/components/common/ui';

export function PotDisplay({ hand, tick }: { hand: HandState | null; tick: number }) {
  const { fmt, chipsFor } = useFmt();
  // Once awarded, the chips have moved to the winners' stacks — the pot is empty.
  const total = hand && !hand.complete ? potsTotal(hand.pots) : 0;
  // Only surface the side-pot breakdown at showdown, where the pots are final
  // (uncalled bets have been refunded). Mid-hand we just show the running total.
  const showSidePots = hand ? hand.pots.length > 1 && hand.street === 'showdown' : false;

  return (
    <div className="flex flex-col items-center select-none">
      <div className="text-[0.6rem] tracking-[0.25em] text-[color:rgba(243,234,210,0.65)] uppercase mb-1">
        Pot
      </div>
      <div
        key={tick}
        className="anim-pot-bump tnum font-display font-semibold text-[var(--cream)] leading-none"
        style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', textShadow: '0 2px 14px rgba(0,0,0,0.6)' }}
      >
        {fmt(total)}
      </div>
      {total > 0 && (
        <div className="mt-2">
          <ChipStackView chips={chipsFor(total, 8)} size={26} />
        </div>
      )}

      {showSidePots && (
        <div className="mt-3 flex flex-wrap gap-1.5 justify-center max-w-[280px]">
          {hand!.pots.map((p, i) => (
            <span
              key={p.id}
              className="glass rounded-full px-2.5 py-1 text-[0.66rem] tnum"
              title={`${p.label}: eligible ${p.eligible.length}`}
            >
              <span className="text-[var(--muted)]">{i === 0 ? 'Main' : `Side ${i}`} </span>
              <span className="text-[var(--gold-soft)] font-semibold">{fmt(p.amount)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
