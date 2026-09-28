import type { ActionType, HandPlayer, HandState, PlayerId } from '@/types';
import { buildPotsFromHand, cloneHand, computeToAct } from './round';

export interface ActionInput {
  type: ActionType;
  /**
   * For 'bet' and 'raise' this is the *total* street commitment to raise TO
   * (not the increment). Ignored for fold/check/call/allin.
   */
  amount?: number;
}

export interface LegalActions {
  yourTurn: boolean;
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canBet: boolean;
  canRaise: boolean;
  /** Minimum total to bet/raise to (before the all-in exception). */
  minTo: number;
  /** Maximum total to bet/raise to = going all-in. */
  maxTo: number;
  canAllIn: boolean;
  allInTo: number;
  /** True when calling would use the player's entire stack. */
  callIsAllIn: boolean;
}

export function toCall(hand: HandState, p: HandPlayer): number {
  return Math.max(0, hand.currentBet - p.streetCommitted);
}

/** Minimum legal total to raise TO (ignoring the short all-in exception). */
export function minRaiseTo(hand: HandState): number {
  return hand.currentBet + Math.max(hand.lastRaiseSize, hand.bigBlind);
}

/** Minimum legal opening bet (ignoring the short all-in exception). */
export function minBet(hand: HandState): number {
  return hand.bigBlind;
}

export function getPlayer(hand: HandState, playerId: PlayerId): HandPlayer | undefined {
  return hand.players.find((p) => p.id === playerId);
}

export function legalActions(hand: HandState, playerId: PlayerId): LegalActions {
  const p = getPlayer(hand, playerId);
  const none: LegalActions = {
    yourTurn: false,
    canFold: false,
    canCheck: false,
    canCall: false,
    callAmount: 0,
    canBet: false,
    canRaise: false,
    minTo: 0,
    maxTo: 0,
    canAllIn: false,
    allInTo: 0,
    callIsAllIn: false,
  };
  if (!p || p.status !== 'active' || hand.toActSeat !== p.seat) return none;

  const call = toCall(hand, p);
  const allInTo = p.streetCommitted + p.stack;
  const facingBet = hand.currentBet > 0;

  const canCheck = call === 0;
  const canCall = call > 0 && p.stack > 0;
  const callAmount = Math.min(call, p.stack);

  // Opening bet is possible only when there is no live bet this street.
  const canBet = !facingBet && p.stack > 0;
  // A raise needs the right to raise and chips beyond the call amount.
  const canRaise = facingBet && p.mayRaise && p.stack > call;

  let minTo = 0;
  let maxTo = 0;
  if (canBet) {
    minTo = Math.min(minBet(hand), allInTo);
    maxTo = allInTo;
  } else if (canRaise) {
    minTo = Math.min(minRaiseTo(hand), allInTo);
    maxTo = allInTo;
  }

  return {
    yourTurn: true,
    canFold: true,
    canCheck,
    canCall,
    callAmount,
    canBet,
    canRaise,
    minTo,
    maxTo,
    canAllIn: p.stack > 0,
    allInTo,
    callIsAllIn: canCall && call >= p.stack,
  };
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validateAction(
  hand: HandState,
  playerId: PlayerId,
  action: ActionInput,
): ValidationResult {
  const p = getPlayer(hand, playerId);
  if (!p) return { ok: false, error: 'Unknown player.' };
  if (hand.complete) return { ok: false, error: 'The hand has already ended.' };
  if (p.status === 'folded') return { ok: false, error: 'Player has folded.' };
  if (p.status === 'allin') return { ok: false, error: 'Player is already all-in.' };
  if (hand.toActSeat !== p.seat) return { ok: false, error: "It is not this player's turn." };

  const legal = legalActions(hand, playerId);
  const call = toCall(hand, p);
  const allInTo = p.streetCommitted + p.stack;

  switch (action.type) {
    case 'fold':
      return { ok: true };

    case 'check':
      if (call !== 0) return { ok: false, error: `Cannot check — ${call} to call.` };
      return { ok: true };

    case 'call':
      if (call <= 0) return { ok: false, error: 'Nothing to call — check instead.' };
      if (p.stack <= 0) return { ok: false, error: 'No chips to call with.' };
      return { ok: true };

    case 'allin':
      if (p.stack <= 0) return { ok: false, error: 'No chips to move all-in.' };
      return { ok: true };

    case 'bet': {
      if (legal.canBet === false) return { ok: false, error: 'Cannot bet — there is a live bet; raise instead.' };
      const to = action.amount ?? 0;
      if (!Number.isInteger(to)) return { ok: false, error: 'Bet must be a whole number.' };
      if (to <= 0) return { ok: false, error: 'Bet must be greater than zero.' };
      if (to > allInTo) return { ok: false, error: `Player only has ${p.stack} — cannot bet that much.` };
      const isAllIn = to === allInTo;
      if (to < minBet(hand) && !isAllIn) {
        return { ok: false, error: `Minimum bet is ${minBet(hand)}.` };
      }
      return { ok: true };
    }

    case 'raise': {
      if (!hand.currentBet) return { ok: false, error: 'No bet to raise — bet instead.' };
      if (!p.mayRaise) return { ok: false, error: 'Raising is not re-opened for this player; call or fold.' };
      const to = action.amount ?? 0;
      if (!Number.isInteger(to)) return { ok: false, error: 'Raise must be a whole number.' };
      if (to <= hand.currentBet) return { ok: false, error: 'A raise must exceed the current bet.' };
      if (to > allInTo) return { ok: false, error: `Player only has ${p.stack} — cannot raise that much.` };
      const isAllIn = to === allInTo;
      if (to < minRaiseTo(hand) && !isAllIn) {
        return { ok: false, error: `Minimum raise is to ${minRaiseTo(hand)}.` };
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: 'Unsupported action.' };
  }
}

function commit(p: HandPlayer, amount: number): number {
  const actual = Math.min(amount, p.stack);
  p.stack -= actual;
  p.streetCommitted += actual;
  p.handCommitted += actual;
  if (p.stack === 0) p.status = 'allin';
  return actual;
}

/** Full re-open: every other active player gets to act again and may raise. */
function reopen(hand: HandState, aggressor: HandPlayer) {
  for (const o of hand.players) {
    if (o.id === aggressor.id) continue;
    if (o.status === 'active') {
      o.hasActed = false;
      o.mayRaise = true;
    }
  }
}

/**
 * Partial re-open after a short all-in: players who had already acted must
 * respond to the extra chips (call/fold) but may NOT re-raise. Players who had
 * not yet acted keep their full rights.
 */
function partialReopen(hand: HandState, aggressor: HandPlayer) {
  for (const o of hand.players) {
    if (o.id === aggressor.id) continue;
    if (o.status === 'active' && o.hasActed) {
      o.hasActed = false;
      o.mayRaise = false;
    }
  }
}

/** Apply reopening logic for an aggressive commitment that raised the bet. */
function applyAggression(hand: HandState, p: HandPlayer, prevBet: number) {
  const newLevel = p.streetCommitted;
  if (newLevel <= prevBet) return; // all-in call for less than the bet — no raise
  const increment = newLevel - prevBet;
  hand.currentBet = newLevel;
  const wasOpening = prevBet === 0;
  if (wasOpening || increment >= hand.lastRaiseSize) {
    hand.lastRaiseSize = wasOpening ? newLevel : increment;
    reopen(hand, p);
  } else {
    // Short all-in raise — does not fully re-open the betting.
    partialReopen(hand, p);
  }
}

/**
 * Apply a validated action and return the resulting hand state. Recomputes the
 * pots and the next player to act. Does NOT advance the street or resolve the
 * hand — the caller inspects the returned state to decide what happens next.
 */
export function applyAction(
  hand: HandState,
  playerId: PlayerId,
  action: ActionInput,
): HandState {
  const h = cloneHand(hand);
  const p = getPlayer(h, playerId)!;
  const prevBet = h.currentBet;

  switch (action.type) {
    case 'fold':
      p.status = 'folded';
      p.hasActed = true;
      break;

    case 'check':
      p.hasActed = true;
      break;

    case 'call':
      commit(p, h.currentBet - p.streetCommitted);
      p.hasActed = true;
      break;

    case 'bet':
      commit(p, (action.amount ?? 0) - p.streetCommitted);
      p.hasActed = true;
      applyAggression(h, p, prevBet);
      break;

    case 'raise':
      commit(p, (action.amount ?? 0) - p.streetCommitted);
      p.hasActed = true;
      applyAggression(h, p, prevBet);
      break;

    case 'allin':
      commit(p, p.stack);
      p.hasActed = true;
      applyAggression(h, p, prevBet);
      break;
  }

  const recordedAmount = amountMoved(hand, h, playerId);
  h.actions.push({
    playerId,
    type: action.type,
    amount: recordedAmount,
    toAmount: p.streetCommitted,
    street: h.street,
    timestamp: Date.now(),
  });

  h.pots = buildPotsFromHand(h);
  h.toActSeat = computeToAct(h, p.seat);
  return h;
}

/** Chips that actually moved from a player's stack between two hand states. */
function amountMoved(before: HandState, after: HandState, playerId: PlayerId): number {
  const b = before.players.find((p) => p.id === playerId)!;
  const a = after.players.find((p) => p.id === playerId)!;
  return b.stack - a.stack;
}
