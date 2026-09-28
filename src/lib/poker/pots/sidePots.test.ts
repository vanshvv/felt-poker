import { describe, it, expect } from 'vitest';
import { buildPots, potsTotal, type Contribution } from './sidePots';

/** Helper: assert a pot's eligible set regardless of order. */
function eligibleSet(pot: { eligible: string[] }) {
  return [...pot.eligible].sort();
}

describe('buildPots — contribution-layer side pots', () => {
  it('single contested pot with equal contributions', () => {
    const c: Contribution[] = [
      { id: 'A', committed: 100, folded: false },
      { id: 'B', committed: 100, folded: false },
      { id: 'C', committed: 100, folded: false },
    ];
    const pots = buildPots(c);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300);
    expect(eligibleSet(pots[0])).toEqual(['A', 'B', 'C']);
    expect(pots[0].label).toBe('Main Pot');
  });

  it('classic three-way all-in creates two side pots', () => {
    const c: Contribution[] = [
      { id: 'A', committed: 100, folded: false }, // short all-in
      { id: 'B', committed: 300, folded: false }, // medium all-in
      { id: 'C', committed: 500, folded: false },
      { id: 'D', committed: 500, folded: false },
    ];
    const pots = buildPots(c);
    expect(potsTotal(pots)).toBe(1400);
    expect(pots).toHaveLength(3);

    expect(pots[0].amount).toBe(400);
    expect(eligibleSet(pots[0])).toEqual(['A', 'B', 'C', 'D']);

    expect(pots[1].amount).toBe(600);
    expect(eligibleSet(pots[1])).toEqual(['B', 'C', 'D']);

    expect(pots[2].amount).toBe(400);
    expect(eligibleSet(pots[2])).toEqual(['C', 'D']);
  });

  it('excludes folded players from eligibility but keeps their chips', () => {
    const c: Contribution[] = [
      { id: 'A', committed: 100, folded: false },
      { id: 'B', committed: 100, folded: true }, // folded, chips stay in pot
      { id: 'C', committed: 100, folded: false },
    ];
    const pots = buildPots(c);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300);
    expect(eligibleSet(pots[0])).toEqual(['A', 'C']);
  });

  it('all-in short player with a folder in a higher layer', () => {
    const c: Contribution[] = [
      { id: 'A', committed: 50, folded: false }, // all-in
      { id: 'B', committed: 200, folded: false },
      { id: 'C', committed: 200, folded: false },
      { id: 'D', committed: 200, folded: true }, // folded but contributed
    ];
    const pots = buildPots(c);
    expect(potsTotal(pots)).toBe(650);
    expect(pots[0].amount).toBe(200); // 4 x 50
    expect(eligibleSet(pots[0])).toEqual(['A', 'B', 'C']);
    expect(pots[1].amount).toBe(450); // 3 x 150
    expect(eligibleSet(pots[1])).toEqual(['B', 'C']);
  });

  it('merges adjacent layers that share the same eligible set', () => {
    const c: Contribution[] = [
      { id: 'A', committed: 100, folded: true }, // folded early money
      { id: 'B', committed: 300, folded: false },
      { id: 'C', committed: 300, folded: false },
    ];
    const pots = buildPots(c);
    // Layer 1 (100): eligible {B,C}; Layer 2 (200): eligible {B,C} -> merge.
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(700);
    expect(eligibleSet(pots[0])).toEqual(['B', 'C']);
  });

  it('ignores zero contributions', () => {
    const c: Contribution[] = [
      { id: 'A', committed: 0, folded: false },
      { id: 'B', committed: 50, folded: false },
      { id: 'C', committed: 50, folded: false },
    ];
    const pots = buildPots(c);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(100);
    expect(eligibleSet(pots[0])).toEqual(['B', 'C']);
  });

  it('conserves chips exactly across many random layers', () => {
    const c: Contribution[] = [
      { id: 'A', committed: 37, folded: false },
      { id: 'B', committed: 91, folded: true },
      { id: 'C', committed: 200, folded: false },
      { id: 'D', committed: 200, folded: false },
      { id: 'E', committed: 15, folded: false },
    ];
    const pots = buildPots(c);
    expect(potsTotal(pots)).toBe(37 + 91 + 200 + 200 + 15);
  });
});
