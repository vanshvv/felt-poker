import type { Pot } from '@/types';
import { uid } from '../ids';

/**
 * Minimal input needed to build pots: each contributor's total chips committed
 * to the hand and whether they folded (folded players' chips stay in the pot
 * but they are not eligible to win it).
 */
export interface Contribution {
  id: string;
  committed: number;
  folded: boolean;
}

/**
 * Build main + side pots from per-player total contributions using a
 * contribution-layer algorithm.
 *
 * The idea: sort by the distinct amounts each player put in. At each rising
 * "level", every player who contributed at least that much adds an equal slice.
 * That slice forms one pot, and only the *non-folded* contributors at that
 * level are eligible to win it. All-in players therefore remain eligible for
 * exactly the pots their chips reached, and no further.
 *
 * Example — A all-in 100, B all-in 300, C 500, D 500 (all called):
 *   level 100: 4 x 100 = 400  eligible {A,B,C,D}   (main pot)
 *   level 300: 3 x 200 = 600  eligible {B,C,D}      (side pot 1)
 *   level 500: 2 x 200 = 400  eligible {C,D}        (side pot 2)
 *   total 1400 == sum of contributions.
 *
 * Uncalled bets should already have been refunded before this runs (see
 * refundUncalledBet), so a layer can never have zero eligible players. As a
 * defensive measure, if that ever happens the layer is refunded to its sole
 * contributor rather than being lost.
 */
export function buildPots(contributions: Contribution[]): Pot[] {
  // Work on a mutable copy of remaining committed chips.
  const remaining = contributions
    .filter((c) => c.committed > 0)
    .map((c) => ({ ...c }));

  const rawPots: { amount: number; eligible: string[]; level: number }[] = [];

  while (true) {
    const positive = remaining.filter((c) => c.committed > 0);
    if (positive.length === 0) break;

    // The thinnest remaining layer is the smallest positive contribution.
    const level = Math.min(...positive.map((c) => c.committed));

    let amount = 0;
    for (const c of positive) {
      amount += level;
      c.committed -= level;
    }

    const eligible = positive.filter((c) => !c.folded).map((c) => c.id);
    rawPots.push({ amount, eligible, level });
  }

  // Merge adjacent layers that share the exact same eligible set — they are
  // effectively one pot and should be displayed as one.
  const merged: typeof rawPots = [];
  for (const pot of rawPots) {
    const prev = merged[merged.length - 1];
    if (prev && sameSet(prev.eligible, pot.eligible)) {
      prev.amount += pot.amount;
      prev.level = pot.level;
    } else {
      merged.push({ ...pot });
    }
  }

  return merged.map((p, i) => ({
    id: uid('pot'),
    amount: p.amount,
    eligible: p.eligible,
    level: p.level,
    label: i === 0 ? 'Main Pot' : `Side Pot ${i}`,
  }));
}

/** Total across all pots. */
export function potsTotal(pots: Pot[]): number {
  return pots.reduce((sum, p) => sum + p.amount, 0);
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((x) => sa.has(x));
}
