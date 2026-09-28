import type { HandAction, HandPlayer, HandState, PlayerId } from '@/types';
import { uid } from './ids';
import { computeBlindSeats } from './blinds/rotation';
import {
  buildPotsFromHand,
  cloneHand,
  computeToAct,
  contenders,
  refundUncalledBet,
} from './betting/round';
import { distributePot, seatOrderFromButton } from './settlement/distribute';

export interface SeatInput {
  id: PlayerId;
  seat: number;
  stack: number;
}

export interface StartHandParams {
  handNumber: number;
  seats: SeatInput[];
  buttonSeat: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

/** Post chips from a player's stack toward the pot (blinds/antes). */
function post(
  p: HandPlayer,
  amount: number,
  toStreet: boolean,
): number {
  const actual = Math.min(amount, p.stack);
  p.stack -= actual;
  p.handCommitted += actual;
  if (toStreet) p.streetCommitted += actual;
  if (p.stack === 0) p.status = 'allin';
  return actual;
}

/**
 * Create a fresh hand: seat the players, post antes then blinds, compute the
 * initial pot and hand the action to the first player to act.
 */
export function startHand(params: StartHandParams): HandState {
  const { handNumber, seats, buttonSeat, smallBlind, bigBlind, ante } = params;
  const players: HandPlayer[] = [...seats]
    .sort((a, b) => a.seat - b.seat)
    .map((s) => ({
      id: s.id,
      seat: s.seat,
      startingStack: s.stack,
      stack: s.stack,
      streetCommitted: 0,
      handCommitted: 0,
      status: 'active' as const,
      hasActed: false,
      mayRaise: true,
    }));

  const occupied = players.map((p) => p.seat);
  const { sbSeat, bbSeat } = computeBlindSeats(occupied, buttonSeat);
  const actions: HandAction[] = [];
  const now = Date.now();

  const hand: HandState = {
    id: uid('hand'),
    handNumber,
    street: 'preflop',
    players,
    buttonSeat,
    sbSeat,
    bbSeat,
    smallBlind,
    bigBlind,
    ante,
    currentBet: 0,
    lastRaiseSize: bigBlind,
    toActSeat: null,
    pots: [],
    actions,
    awards: [],
    complete: false,
  };

  // Antes (dead money — do not count toward the current bet).
  if (ante > 0) {
    for (const p of players) {
      const posted = post(p, ante, false);
      if (posted > 0) {
        actions.push(mkAction(p.id, 'post-ante', posted, p.streetCommitted, now));
      }
    }
  }

  // Blinds.
  const sb = players.find((p) => p.seat === sbSeat);
  const bb = players.find((p) => p.seat === bbSeat);
  if (sb) {
    const posted = post(sb, smallBlind, true);
    actions.push(mkAction(sb.id, 'post-sb', posted, sb.streetCommitted, now));
  }
  if (bb && bb !== sb) {
    const posted = post(bb, bigBlind, true);
    actions.push(mkAction(bb.id, 'post-bb', posted, bb.streetCommitted, now));
  }

  hand.currentBet = Math.max(bigBlind, ...players.map((p) => p.streetCommitted));
  hand.lastRaiseSize = bigBlind;
  hand.pots = buildPotsFromHand(hand);
  hand.toActSeat = computeToAct(hand, bbSeat);
  return hand;
}

function mkAction(
  playerId: PlayerId,
  type: HandAction['type'],
  amount: number,
  toAmount: number,
  timestamp: number,
): HandAction {
  return { playerId, type, amount, toAmount, street: 'preflop', timestamp };
}

export interface ShowdownSelection {
  potId: string;
  winnerIds: PlayerId[];
}

/**
 * Resolve the hand by awarding each pot to its selected winner(s), crediting
 * their stacks. Returns the closed hand with awards recorded.
 */
export function finalizeHand(hand: HandState, selections: ShowdownSelection[]): HandState {
  // The pots are already final by the time we settle (uncalled bets were
  // refunded as each street closed). We must NOT rebuild them here, or their
  // ids would change and no longer match the caller's winner selections.
  const h = cloneHand(hand);

  const order = seatOrderFromButton(
    h.players.map((p) => ({ id: p.id, seat: p.seat })),
    h.buttonSeat,
  );

  h.awards = [];
  for (const pot of h.pots) {
    const sel = selections.find((s) => s.potId === pot.id);
    const winnerIds = sel ? sel.winnerIds : [];
    const award = distributePot(pot, winnerIds, order);
    h.awards.push(award);
    for (const w of award.winners) {
      const player = h.players.find((p) => p.id === w.playerId);
      if (player) player.stack += w.amount;
    }
  }

  h.complete = true;
  h.street = 'complete';
  h.toActSeat = null;
  return h;
}

/**
 * Resolve a hand that ended because everyone else folded: the sole remaining
 * contender collects every pot (including dead money from folders).
 */
export function resolveUncontested(hand: HandState): HandState {
  const h = cloneHand(hand);
  refundUncalledBet(h);
  h.pots = buildPotsFromHand(h);
  const remaining = contenders(h);
  if (remaining.length !== 1) return h; // caller misuse — nothing to do
  const winner = remaining[0];
  const selections = h.pots.map((pot) => ({ potId: pot.id, winnerIds: [winner.id] }));
  return finalizeHand(h, selections);
}
