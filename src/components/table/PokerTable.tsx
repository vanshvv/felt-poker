import type { HandState, Player, PlayerId } from '@/types';
import { PlayerSeat } from './PlayerSeat';
import { PotDisplay } from './PotDisplay';
import { StreetIndicator } from './StreetIndicator';

export interface TableMarks {
  buttonSeat: number;
  sbSeat: number;
  bbSeat: number;
}

/**
 * Angle for player index i of n. Players are spread clockwise but a slot is
 * left empty at the very bottom (where the control dock lives), so no seat is
 * ever hidden behind it.
 */
function angleForIndex(i: number, n: number) {
  return Math.PI / 2 + ((i + 1) * 2 * Math.PI) / (n + 1);
}

/** Position on the seating ellipse for player index i of n. */
function seatPosition(i: number, n: number) {
  const angle = angleForIndex(i, n);
  const rx = 47;
  const ry = 45;
  const x = 50 + rx * Math.cos(angle);
  const y = 50 + ry * Math.sin(angle);
  return { x, y, angle };
}

export function PokerTable({
  players,
  hand,
  toActSeat,
  marks,
  winnings,
  onSelectPlayer,
  tick,
  compact,
}: {
  players: Player[];
  hand: HandState | null;
  toActSeat: number | null;
  marks: TableMarks | null;
  winnings: Record<PlayerId, number>;
  onSelectPlayer: (id: PlayerId) => void;
  tick: number;
  compact: boolean;
}) {
  const seated = players.filter((p) => p.cashedOut == null).sort((a, b) => a.seat - b.seat);
  const n = seated.length;
  const handById = new Map(hand?.players.map((hp) => [hp.id, hp]) ?? []);

  // Reserve a gutter on each side so seat cards (which straddle the felt edge)
  // never get clipped by the viewport. The felt + seats live inside this box.
  const gutter = compact ? 60 : 86;

  return (
    <div className="relative w-full" style={{ aspectRatio: compact ? '3 / 4' : '16 / 10' }}>
     <div className="absolute top-0 bottom-0" style={{ left: gutter, right: gutter }}>
      {/* Rail */}
      <div
        className="absolute rounded-[46%] felt"
        style={{
          top: compact ? '11%' : '9%',
          bottom: compact ? '11%' : '9%',
          left: compact ? '5%' : '8%',
          right: compact ? '5%' : '8%',
          border: `${compact ? 10 : 16}px solid var(--rail)`,
          boxShadow:
            'inset 0 0 60px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(217,181,89,0.14), 0 30px 70px -20px rgba(0,0,0,0.8)',
        }}
      >
        {/* inner betting line */}
        <div
          className="absolute rounded-[46%] pointer-events-none"
          style={{ top: '9%', bottom: '9%', left: '9%', right: '9%', border: '1px dashed rgba(243,234,210,0.14)' }}
        />
        {/* center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
          <StreetIndicator hand={hand} />
          <PotDisplay hand={hand} tick={tick} />
        </div>

        {/* dealer button token */}
        {marks && seated.some((p) => p.seat === marks.buttonSeat) && (
          <DealerToken index={seated.findIndex((p) => p.seat === marks.buttonSeat)} n={n} />
        )}
      </div>

      {/* Seats layer (can overflow the felt onto the rail) */}
      <div className="absolute inset-0">
        {seated.map((p, i) => {
          const pos = seatPosition(i, n);
          return (
            <div
              key={p.id}
              className="absolute"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              <PlayerSeat
                player={p}
                hp={handById.get(p.id) ?? null}
                isToAct={toActSeat === p.seat}
                badges={{
                  dealer: marks?.buttonSeat === p.seat,
                  sb: marks?.sbSeat === p.seat,
                  bb: marks?.bbSeat === p.seat,
                }}
                wonAmount={winnings[p.id] ?? null}
                onSelect={() => onSelectPlayer(p.id)}
                compact={compact}
              />
            </div>
          );
        })}
      </div>
     </div>
    </div>
  );
}

function DealerToken({ index, n }: { index: number; n: number }) {
  // Sit the button a little inside the seat, toward the pot.
  const angle = angleForIndex(index, n);
  const x = 50 + 34 * Math.cos(angle);
  const y = 50 + 33 * Math.sin(angle);
  return (
    <div
      className="absolute badge badge-d anim-pop"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%,-50%)',
        width: '1.6rem',
        height: '1.6rem',
        fontSize: '0.7rem',
        transition: 'left 0.4s ease, top 0.4s ease',
      }}
      title="Dealer button"
    >
      D
    </div>
  );
}
