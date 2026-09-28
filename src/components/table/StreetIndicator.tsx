import type { HandState, Street } from '@/types';
import { useFmt } from '@/components/common/useFmt';

const STREETS: { key: Street; label: string }[] = [
  { key: 'preflop', label: 'Pre-Flop' },
  { key: 'flop', label: 'Flop' },
  { key: 'turn', label: 'Turn' },
  { key: 'river', label: 'River' },
  { key: 'showdown', label: 'Showdown' },
];

export function StreetIndicator({ hand }: { hand: HandState | null }) {
  const { fmt } = useFmt();
  const active = hand ? (hand.street === 'complete' ? 'showdown' : hand.street) : 'preflop';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1">
        {STREETS.map((s) => {
          const on = s.key === active;
          return (
            <div
              key={s.key}
              className="rounded-full transition-all"
              style={{
                padding: on ? '3px 12px' : '3px 8px',
                fontSize: '0.66rem',
                fontWeight: on ? 700 : 500,
                letterSpacing: '0.04em',
                background: on ? 'linear-gradient(180deg,var(--gold-soft),var(--gold))' : 'rgba(255,255,255,0.06)',
                color: on ? '#23180a' : 'var(--muted)',
                border: '1px solid ' + (on ? 'transparent' : 'rgba(255,255,255,0.08)'),
              }}
            >
              {s.label}
            </div>
          );
        })}
      </div>
      {hand && (
        <div className="text-[0.64rem] text-[color:rgba(243,234,210,0.55)] tracking-wide">
          Hand #{hand.handNumber} · Blinds {fmt(hand.smallBlind)}/{fmt(hand.bigBlind)}
          {hand.ante > 0 && <> · Ante {fmt(hand.ante)}</>}
        </div>
      )}
    </div>
  );
}
