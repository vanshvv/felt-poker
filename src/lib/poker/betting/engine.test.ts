import { describe, it, expect } from 'vitest';
import { startHand, finalizeHand, resolveUncontested, type SeatInput } from '../hand';
import { applyAction, legalActions, validateAction } from './actions';
import { advanceStreet, isBettingRoundComplete, onlyOneContender } from './round';
import { potsTotal } from '../pots/sidePots';
import { validateHandConservation } from '../accounting';
import type { HandState, PlayerId } from '@/types';

function seat(id: PlayerId, s: number, stack: number): SeatInput {
  return { id, seat: s, stack };
}
function player(h: HandState, id: PlayerId) {
  return h.players.find((p) => p.id === id)!;
}
function threeHanded(stacks: [number, number, number] = [1000, 1000, 1000]) {
  return startHand({
    handNumber: 1,
    seats: [seat('p0', 0, stacks[0]), seat('p1', 1, stacks[1]), seat('p2', 2, stacks[2])],
    buttonSeat: 0,
    smallBlind: 10,
    bigBlind: 20,
    ante: 0,
  });
}

describe('startHand — blinds and initial state', () => {
  it('posts blinds and sets the first player to act (3-handed)', () => {
    const h = threeHanded();
    expect(h.sbSeat).toBe(1);
    expect(h.bbSeat).toBe(2);
    expect(player(h, 'p1').stack).toBe(990);
    expect(player(h, 'p2').stack).toBe(980);
    expect(player(h, 'p0').stack).toBe(1000);
    expect(h.currentBet).toBe(20);
    expect(h.toActSeat).toBe(0); // button acts first pre-flop, 3-handed
    expect(potsTotal(h.pots)).toBe(30);
  });

  it('handles heads-up: button posts SB and acts first pre-flop', () => {
    const h = startHand({
      handNumber: 1,
      seats: [seat('p0', 0, 1000), seat('p1', 1, 1000)],
      buttonSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      ante: 0,
    });
    expect(h.sbSeat).toBe(0);
    expect(h.bbSeat).toBe(1);
    expect(h.toActSeat).toBe(0);
    const flop = advanceStreetAfter(h, () => {
      let g = applyAction(h, 'p0', { type: 'call' });
      g = applyAction(g, 'p1', { type: 'check' });
      return g;
    });
    expect(flop.street).toBe('flop');
    expect(flop.toActSeat).toBe(1); // BB acts first post-flop heads-up
  });

  it('posts antes as dead money that does not change the call amount', () => {
    const h = startHand({
      handNumber: 1,
      seats: [seat('p0', 0, 1000), seat('p1', 1, 1000), seat('p2', 2, 1000)],
      buttonSeat: 0,
      smallBlind: 10,
      bigBlind: 20,
      ante: 5,
    });
    // 3 antes + SB + BB = 15 + 30 = 45
    expect(potsTotal(h.pots)).toBe(45);
    expect(h.currentBet).toBe(20);
    expect(player(h, 'p0').stack).toBe(995); // ante only
    expect(player(h, 'p1').stack).toBe(985); // ante + SB
    expect(player(h, 'p2').stack).toBe(975); // ante + BB
  });
});

function advanceStreetAfter(_start: HandState, run: () => HandState): HandState {
  const done = run();
  return advanceStreet(done);
}

describe('basic betting round flow', () => {
  it('call, call, check completes the round and folds into the pot', () => {
    let h = threeHanded();
    h = applyAction(h, 'p0', { type: 'call' });
    expect(player(h, 'p0').stack).toBe(980);
    expect(h.toActSeat).toBe(1);

    h = applyAction(h, 'p1', { type: 'call' }); // SB completes
    expect(player(h, 'p1').stack).toBe(980);
    expect(h.toActSeat).toBe(2);

    h = applyAction(h, 'p2', { type: 'check' }); // BB option
    expect(isBettingRoundComplete(h)).toBe(true);
    expect(h.toActSeat).toBeNull();

    const flop = advanceStreet(h);
    expect(flop.street).toBe('flop');
    expect(flop.currentBet).toBe(0);
    expect(flop.toActSeat).toBe(1); // SB first to act post-flop
    expect(flop.pots[0].amount).toBe(60);
  });
});

describe('action validation', () => {
  it('enforces the minimum raise', () => {
    const h = threeHanded();
    expect(validateAction(h, 'p0', { type: 'raise', amount: 30 }).ok).toBe(false);
    expect(validateAction(h, 'p0', { type: 'raise', amount: 40 }).ok).toBe(true);
  });

  it('rejects acting out of turn', () => {
    const h = threeHanded();
    expect(validateAction(h, 'p1', { type: 'call' }).ok).toBe(false);
  });

  it('rejects a bet when facing a live bet (must raise)', () => {
    const h = threeHanded();
    expect(validateAction(h, 'p0', { type: 'bet', amount: 100 }).ok).toBe(false);
  });

  it('prevents betting more than the stack, but allows an all-in for less', () => {
    const h = threeHanded([80, 1000, 1000]);
    const la = legalActions(h, 'p0');
    expect(la.allInTo).toBe(80);
    expect(la.maxTo).toBe(80);
    expect(validateAction(h, 'p0', { type: 'raise', amount: 100 }).ok).toBe(false);
    expect(validateAction(h, 'p0', { type: 'raise', amount: 80 }).ok).toBe(true);
  });

  it('offers check (not call) when the bet is already matched', () => {
    let h = threeHanded();
    h = applyAction(h, 'p0', { type: 'call' });
    h = applyAction(h, 'p1', { type: 'call' });
    const la = legalActions(h, 'p2');
    expect(la.canCheck).toBe(true);
    expect(la.canCall).toBe(false);
  });
});

describe('incomplete-raise (all-in for less) does not re-open betting', () => {
  it('a short all-in denies previously-acted players the right to re-raise', () => {
    // p2 is the BB with only 80 chips.
    let h = threeHanded([1000, 1000, 80]);
    h = applyAction(h, 'p0', { type: 'raise', amount: 60 }); // full raise
    expect(h.lastRaiseSize).toBe(40);
    h = applyAction(h, 'p1', { type: 'call' }); // calls 60
    h = applyAction(h, 'p2', { type: 'allin' }); // all-in to 80 (short raise)

    expect(player(h, 'p2').status).toBe('allin');
    expect(h.currentBet).toBe(80);
    expect(h.toActSeat).toBe(0);

    const la0 = legalActions(h, 'p0');
    expect(la0.canRaise).toBe(false); // may only call or fold
    expect(la0.canCall).toBe(true);
    expect(la0.callAmount).toBe(20);

    h = applyAction(h, 'p0', { type: 'call' });
    const la1 = legalActions(h, 'p1');
    expect(la1.canRaise).toBe(false);
    expect(la1.canCall).toBe(true);
  });
});

describe('multi-way all-in, side pots and settlement', () => {
  it('builds correct side pots and conserves all chips through showdown', () => {
    let h = threeHanded([100, 300, 300]);
    h = applyAction(h, 'p0', { type: 'allin' }); // 100
    h = applyAction(h, 'p1', { type: 'allin' }); // 300
    h = applyAction(h, 'p2', { type: 'allin' }); // 300 (all-in call)

    expect(onlyOneContender(h)).toBe(false);
    expect(isBettingRoundComplete(h)).toBe(true);
    expect(h.toActSeat).toBeNull();

    // Run the board out to showdown.
    h = advanceStreet(h); // flop
    h = advanceStreet(h); // turn
    h = advanceStreet(h); // river
    h = advanceStreet(h); // showdown
    expect(h.street).toBe('showdown');

    expect(h.pots).toHaveLength(2);
    expect(h.pots[0].amount).toBe(300);
    expect([...h.pots[0].eligible].sort()).toEqual(['p0', 'p1', 'p2']);
    expect(h.pots[1].amount).toBe(400);
    expect([...h.pots[1].eligible].sort()).toEqual(['p1', 'p2']);

    const done = finalizeHand(
      h,
      h.pots.map((p) => ({ potId: p.id, winnerIds: ['p2'] })),
    );
    expect(done.complete).toBe(true);
    expect(player(done, 'p2').stack).toBe(700);
    expect(player(done, 'p0').stack).toBe(0);
    expect(validateHandConservation(done)).toBe(true);
  });

  it('splits the main pot while one player takes the side pot', () => {
    // p0 short all-in; p1 and p2 chop the main, p1 wins the side.
    let h = threeHanded([100, 300, 300]);
    h = applyAction(h, 'p0', { type: 'allin' });
    h = applyAction(h, 'p1', { type: 'allin' });
    h = applyAction(h, 'p2', { type: 'allin' });
    h = advanceStreet(h);
    h = advanceStreet(h);
    h = advanceStreet(h);
    h = advanceStreet(h);

    const done = finalizeHand(h, [
      { potId: h.pots[0].id, winnerIds: ['p1', 'p2'] }, // split 300 -> 150 each
      { potId: h.pots[1].id, winnerIds: ['p1'] }, // 400 to p1
    ]);
    expect(player(done, 'p1').stack).toBe(150 + 400);
    expect(player(done, 'p2').stack).toBe(150);
    expect(player(done, 'p0').stack).toBe(0);
    expect(validateHandConservation(done)).toBe(true);
  });
});

describe('uncontested pot (everyone folds)', () => {
  it('returns the uncalled bet and awards the dead money to the last player', () => {
    let h = threeHanded();
    h = applyAction(h, 'p0', { type: 'raise', amount: 60 });
    h = applyAction(h, 'p1', { type: 'fold' });
    h = applyAction(h, 'p2', { type: 'fold' });
    expect(onlyOneContender(h)).toBe(true);

    const done = resolveUncontested(h);
    expect(done.complete).toBe(true);
    // p0 gets the uncalled 40 back and wins the 50 pot (SB 10 + BB 20 + own 20).
    expect(player(done, 'p0').stack).toBe(1030);
    const award = done.awards.find((a) => a.winners.some((w) => w.playerId === 'p0'));
    expect(award?.winners[0].amount).toBe(50);
    expect(validateHandConservation(done)).toBe(true);
  });
});
