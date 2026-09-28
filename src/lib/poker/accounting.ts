import type { AccountingReport, GameState, HandState, Player } from '@/types';
import { potsTotal } from './pots/sidePots';

/** A player's live contribution sitting in the current hand's pots. */
export function livePotContribution(state: GameState, playerId: string): number {
  const h = state.hand;
  if (!h || h.complete) return 0;
  const hp = h.players.find((p) => p.id === playerId);
  return hp ? hp.handCommitted : 0;
}

/**
 * A player's current chip value: their at-rest stack plus any chips they have
 * committed to the live pot (which may still come back to them).
 */
export function playerValue(state: GameState, player: Player): number {
  if (player.cashedOut != null) return player.cashedOut;
  return player.stack + livePotContribution(state, player.id);
}

/** Net result for a player = current value − total money bought in. */
export function playerNet(state: GameState, player: Player): number {
  return playerValue(state, player) - player.buyIns;
}

/** Total chips currently on the table (stacks + live pots). */
export function tableMoney(state: GameState): number {
  const inStacks = state.players
    .filter((p) => p.cashedOut == null)
    .reduce((s, p) => s + p.stack, 0);
  const inPots =
    state.hand && !state.hand.complete ? potsTotal(state.hand.pots) : 0;
  return inStacks + inPots;
}

/**
 * Validate the session's accounting invariants:
 *  - table money + cash-outs must equal total buy-ins
 *  - the sum of every player's net result must be zero
 */
export function validateAccounting(state: GameState): AccountingReport {
  const totalBuyIns = state.players.reduce((s, p) => s + p.buyIns, 0);
  const totalCashOut = state.players.reduce((s, p) => s + (p.cashedOut ?? 0), 0);
  const table = tableMoney(state);
  const netSum = state.players.reduce((s, p) => s + playerNet(state, p), 0);
  const messages: string[] = [];

  const conservation = table + totalCashOut - totalBuyIns;
  if (conservation !== 0) {
    messages.push(
      `Table balance mismatch of ${conservation}: stacks + pots + cash-outs (${
        table + totalCashOut
      }) ≠ buy-ins (${totalBuyIns}).`,
    );
  }
  if (netSum !== 0) {
    messages.push(`Player net results sum to ${netSum}, expected 0.`);
  }

  return {
    ok: messages.length === 0,
    totalBuyIns,
    tableMoney: table,
    totalCashOut,
    netSum,
    messages,
  };
}

/**
 * Chip-conservation check for a single hand: the chips in play at the end must
 * equal the chips the dealt players started the hand with.
 */
export function validateHandConservation(hand: HandState): boolean {
  const startTotal = hand.players.reduce((s, p) => s + p.startingStack, 0);
  // Once the hand is complete the pot chips have been paid into stacks, so we
  // must not count them again.
  const inPots = hand.complete ? 0 : potsTotal(hand.pots);
  const endTotal = hand.players.reduce((s, p) => s + p.stack, 0) + inPots;
  return startTotal === endTotal;
}
