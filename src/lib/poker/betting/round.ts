import type { HandPlayer, HandState, Street } from '@/types';
import { buildPots } from '../pots/sidePots';
import { seatsAfter } from '../blinds/rotation';

/** Deep-ish clone of a hand (players are copied so callers stay pure). */
export function cloneHand(hand: HandState): HandState {
  return {
    ...hand,
    players: hand.players.map((p) => ({ ...p })),
    pots: hand.pots.map((p) => ({ ...p, eligible: [...p.eligible] })),
    actions: [...hand.actions],
    awards: hand.awards.map((a) => ({ ...a, winners: a.winners.map((w) => ({ ...w })) })),
  };
}

/** Players who can still take a voluntary action (not folded, not all-in). */
export function actionablePlayers(hand: HandState): HandPlayer[] {
  return hand.players.filter((p) => p.status === 'active');
}

/** Players still eligible to win the hand (active or all-in). */
export function contenders(hand: HandState): HandPlayer[] {
  return hand.players.filter((p) => p.status !== 'folded');
}

/** True when only one player has not folded — the hand is won uncontested. */
export function onlyOneContender(hand: HandState): boolean {
  return contenders(hand).length <= 1;
}

/**
 * Does this player still owe an action this street? True when they are active
 * and either haven't acted since the last aggression, or still face a bet they
 * have not matched.
 */
export function needsToAct(hand: HandState, p: HandPlayer): boolean {
  if (p.status !== 'active') return false;
  return !p.hasActed || p.streetCommitted < hand.currentBet;
}

/**
 * The next seat that must act, scanning clockwise from `fromSeat` (exclusive).
 * Returns null when the betting round is complete.
 */
export function computeToAct(hand: HandState, fromSeat: number): number | null {
  const seats = hand.players.map((p) => p.seat);
  for (const seat of seatsAfter(seats, fromSeat)) {
    const p = hand.players.find((x) => x.seat === seat)!;
    if (needsToAct(hand, p)) return seat;
  }
  return null;
}

/** True when no actionable player still owes an action this street. */
export function isBettingRoundComplete(hand: HandState): boolean {
  const actionable = actionablePlayers(hand);
  if (actionable.length === 0) return true;
  return actionable.every((p) => p.hasActed && p.streetCommitted === hand.currentBet);
}

/** Recompute main + side pots from players' total hand contributions. */
export function buildPotsFromHand(hand: HandState) {
  return buildPots(
    hand.players.map((p) => ({
      id: p.id,
      committed: p.handCommitted,
      folded: p.status === 'folded',
    })),
  );
}

/**
 * Refund an uncalled bet at the end of a betting round. If exactly one player
 * committed more than everyone else this street, the excess over the
 * next-highest commitment was never called and is returned to them.
 */
export function refundUncalledBet(hand: HandState): number {
  const committed = hand.players.map((p) => p.streetCommitted);
  const max = Math.max(0, ...committed);
  if (max <= 0) return 0;

  const atMax = hand.players.filter((p) => p.streetCommitted === max);
  if (atMax.length !== 1) return 0; // top bet was matched by someone

  const secondBest = Math.max(
    0,
    ...hand.players.filter((p) => p.streetCommitted < max).map((p) => p.streetCommitted),
  );
  const refund = max - secondBest;
  if (refund <= 0) return 0;

  const p = atMax[0];
  p.stack += refund;
  p.streetCommitted -= refund;
  p.handCommitted -= refund;
  // If this bet was what put them all-in, they now have chips again.
  if (p.status === 'allin' && p.stack > 0) p.status = 'active';
  return refund;
}

const STREET_ORDER: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown', 'complete'];

export function nextStreet(street: Street): Street {
  const idx = STREET_ORDER.indexOf(street);
  return STREET_ORDER[Math.min(idx + 1, STREET_ORDER.length - 1)];
}

/**
 * Advance to the next street: refund any uncalled bet, fold street commitments
 * into the pots, reset per-street state and set the first player to act.
 * Assumes the current betting round is complete.
 */
export function advanceStreet(hand: HandState): HandState {
  const h = cloneHand(hand);
  refundUncalledBet(h);

  h.street = nextStreet(h.street);
  for (const p of h.players) {
    p.streetCommitted = 0;
    if (p.status === 'active') {
      p.hasActed = false;
      p.mayRaise = true;
    }
  }
  h.currentBet = 0;
  h.lastRaiseSize = h.bigBlind;
  h.pots = buildPotsFromHand(h);

  if (h.street === 'showdown' || h.street === 'complete') {
    h.toActSeat = null;
  } else {
    h.toActSeat = computeToAct(h, h.buttonSeat);
  }
  return h;
}
