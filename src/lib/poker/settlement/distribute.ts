import type { Pot, PotAward, PlayerId } from '@/types';

/**
 * Distribute a single pot among the chosen winners.
 *
 * The pot is split as evenly as possible. When it does not divide evenly, the
 * leftover "odd chips" are awarded one at a time to the winners in the order
 * they sit *clockwise from the dealer button* — i.e. the winner in the earliest
 * position (closest to the left of the button) receives the first odd chip.
 * This is the standard high-hand odd-chip rule used in casino poker.
 *
 * `seatOrderFromButton` must list the winners' player ids ordered starting from
 * the seat immediately left of the button and proceeding clockwise. Only the
 * relative order matters.
 *
 * @param pot            the pot being resolved
 * @param winnerIds      the subset of eligible players declared winners
 * @param seatOrderFromButton all winner ids in clockwise-from-button order
 */
export function distributePot(
  pot: Pot,
  winnerIds: PlayerId[],
  seatOrderFromButton: PlayerId[],
): PotAward {
  const winners = winnerIds.filter((id) => pot.eligible.includes(id));
  if (winners.length === 0) {
    // No valid winner selected — should be prevented by the UI; return unsplit.
    return { potId: pot.id, potLabel: pot.label, winners: [] };
  }

  const base = Math.floor(pot.amount / winners.length);
  let remainder = pot.amount - base * winners.length;

  // Order winners by their clockwise distance from the button so odd chips are
  // assigned deterministically and per the documented rule.
  const ordered = [...winners].sort(
    (a, b) => seatOrderFromButton.indexOf(a) - seatOrderFromButton.indexOf(b),
  );

  const awards = ordered.map((playerId) => {
    let amount = base;
    if (remainder > 0) {
      amount += 1;
      remainder -= 1;
    }
    return { playerId, amount };
  });

  return { potId: pot.id, potLabel: pot.label, winners: awards };
}

/**
 * Produce a player-id list ordered clockwise starting from the seat immediately
 * to the left of the button. Used to feed distributePot's odd-chip rule.
 */
export function seatOrderFromButton(
  players: { id: PlayerId; seat: number }[],
  buttonSeat: number,
): PlayerId[] {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const after = sorted.filter((p) => p.seat > buttonSeat);
  const before = sorted.filter((p) => p.seat <= buttonSeat);
  return [...after, ...before].map((p) => p.id);
}
