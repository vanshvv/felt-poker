import { describe, it, expect } from 'vitest';
import { distributePot, seatOrderFromButton } from './distribute';
import type { Pot } from '@/types';

function pot(amount: number, eligible: string[]): Pot {
  return { id: 'p1', amount, eligible, level: amount, label: 'Main Pot' };
}

describe('distributePot', () => {
  it('awards the whole pot to a single winner', () => {
    const award = distributePot(pot(400, ['A', 'B', 'C']), ['A'], ['A', 'B', 'C']);
    expect(award.winners).toEqual([{ playerId: 'A', amount: 400 }]);
  });

  it('splits evenly between two winners', () => {
    const award = distributePot(pot(400, ['A', 'B']), ['A', 'B'], ['A', 'B']);
    expect(award.winners).toEqual([
      { playerId: 'A', amount: 200 },
      { playerId: 'B', amount: 200 },
    ]);
  });

  it('gives the odd chip to the winner closest to the left of the button', () => {
    // Order from button: B acts before A.
    const award = distributePot(pot(401, ['A', 'B']), ['A', 'B'], ['B', 'A']);
    const map = Object.fromEntries(award.winners.map((w) => [w.playerId, w.amount]));
    expect(map).toEqual({ B: 201, A: 200 });
  });

  it('distributes multiple odd chips in button order', () => {
    const award = distributePot(pot(5, ['A', 'B', 'C']), ['A', 'B', 'C'], ['A', 'B', 'C']);
    const map = Object.fromEntries(award.winners.map((w) => [w.playerId, w.amount]));
    expect(map).toEqual({ A: 2, B: 2, C: 1 });
  });

  it('ignores winners that are not eligible for the pot', () => {
    const award = distributePot(pot(300, ['A', 'B']), ['A', 'C'], ['A', 'B']);
    expect(award.winners).toEqual([{ playerId: 'A', amount: 300 }]);
  });

  it('total awarded always equals the pot', () => {
    const award = distributePot(pot(1000, ['A', 'B', 'C']), ['A', 'B', 'C'], ['A', 'B', 'C']);
    const total = award.winners.reduce((s, w) => s + w.amount, 0);
    expect(total).toBe(1000);
  });
});

describe('seatOrderFromButton', () => {
  it('orders players clockwise from the seat left of the button', () => {
    const players = [
      { id: 'A', seat: 0 },
      { id: 'B', seat: 1 },
      { id: 'C', seat: 2 },
      { id: 'D', seat: 3 },
    ];
    expect(seatOrderFromButton(players, 1)).toEqual(['C', 'D', 'A', 'B']);
  });

  it('handles gaps in seat numbers', () => {
    const players = [
      { id: 'A', seat: 0 },
      { id: 'C', seat: 4 },
      { id: 'E', seat: 7 },
    ];
    expect(seatOrderFromButton(players, 4)).toEqual(['E', 'A', 'C']);
  });
});
