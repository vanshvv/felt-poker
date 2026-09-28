import type { HandPlayer, Player } from '@/types';
import { useFmt } from '@/components/common/useFmt';
import { ChipStackView } from '@/components/common/ui';

export interface SeatBadges {
  dealer: boolean;
  sb: boolean;
  bb: boolean;
}

export function PlayerSeat({
  player,
  hp,
  isToAct,
  badges,
  wonAmount,
  onSelect,
  compact,
}: {
  player: Player;
  hp: HandPlayer | null;
  isToAct: boolean;
  badges: SeatBadges;
  wonAmount: number | null;
  onSelect: () => void;
  compact?: boolean;
}) {
  const { fmt, chipsFor } = useFmt();
  const folded = hp?.status === 'folded';
  const allin = hp?.status === 'allin';
  const bet = hp?.streetCommitted ?? 0;
  const liveStack = hp ? hp.stack : player.stack;

  return (
    <div className="relative flex flex-col items-center" style={{ width: compact ? 116 : 150 }}>
      {/* Current street bet — chips pushed toward the pot */}
      {bet > 0 && !folded && (
        <div className="flex items-center gap-1.5 mb-1.5 anim-pop">
          <ChipStackView chips={chipsFor(bet, 5)} size={compact ? 18 : 22} />
          <span className="tnum text-xs font-semibold text-[var(--gold-soft)]">{fmt(bet)}</span>
        </div>
      )}

      <button
        onClick={onSelect}
        className={`glass relative w-full rounded-2xl px-3 py-2.5 text-left transition ${
          isToAct ? 'to-act' : ''
        } ${wonAmount != null ? 'win-glow' : ''}`}
        style={{
          borderColor: isToAct ? 'var(--panel-brd-strong)' : undefined,
          opacity: folded ? 0.5 : 1,
          filter: folded ? 'grayscale(0.6)' : undefined,
        }}
      >
        {/* accent bar */}
        <span
          className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
          style={{ background: player.color, boxShadow: `0 0 10px ${player.color}88` }}
        />

        <div className="flex items-center gap-1.5 mb-0.5 pl-1.5">
          <span className="font-semibold truncate flex-1" style={{ fontSize: compact ? 13 : 15 }}>
            {player.name}
          </span>
          <SeatBadgeRow badges={badges} />
        </div>

        <div className="pl-1.5 flex items-baseline gap-1.5">
          <span
            className="tnum font-bold"
            style={{ fontSize: compact ? 18 : 22, color: allin ? 'var(--gold)' : 'var(--ink)' }}
          >
            {fmt(liveStack)}
          </span>
        </div>

        <div className="pl-1.5 mt-0.5 h-4 text-[0.68rem] font-semibold tracking-wide">
          {wonAmount != null ? (
            <span className="text-[var(--win)] tnum">WON +{fmt(wonAmount)}</span>
          ) : folded ? (
            <span className="text-[var(--muted-2)]">FOLDED</span>
          ) : allin ? (
            <span className="text-[var(--gold)]">ALL-IN</span>
          ) : player.sittingOut && !hp ? (
            <span className="text-[var(--muted-2)]">SITTING OUT</span>
          ) : (
            <span className="text-[var(--muted-2)]">{hp ? 'In hand' : 'Waiting'}</span>
          )}
        </div>
      </button>
    </div>
  );
}

function SeatBadgeRow({ badges }: { badges: SeatBadges }) {
  return (
    <span className="flex items-center gap-1">
      {badges.dealer && <span className="badge badge-d" title="Dealer">D</span>}
      {badges.sb && <span className="badge badge-sb" title="Small blind">SB</span>}
      {badges.bb && <span className="badge badge-bb" title="Big blind">BB</span>}
    </span>
  );
}
