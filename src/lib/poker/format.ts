import type { ChipDenomination } from '@/types';

/** Format an integer amount with a currency symbol and grouped digits. */
export function formatMoney(amount: number, currency = '₹'): string {
  const sign = amount < 0 ? '-' : '';
  const n = Math.abs(Math.round(amount));
  // Indian-style grouping when the symbol is the rupee, else Western grouping.
  const grouped =
    currency === '₹' ? groupIndian(n) : n.toLocaleString('en-US');
  return `${sign}${currency}${grouped}`;
}

/** Signed money, always shows +/-. Used for profit/loss. */
export function formatSigned(amount: number, currency = '₹'): string {
  const s = formatMoney(Math.abs(amount), currency);
  if (amount > 0) return `+${s}`;
  if (amount < 0) return `-${s}`;
  return s;
}

function groupIndian(n: number): string {
  const s = String(n);
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

/**
 * Break an amount down into chips using a greedy largest-first algorithm over
 * the configured denominations. This is purely a *visual* representation — the
 * engine always works on the numeric amount. Returns [] if it can't be made
 * exactly from the denominations.
 */
export function chipBreakdown(
  amount: number,
  denominations: ChipDenomination[],
): { denom: ChipDenomination; count: number }[] {
  const out: { denom: ChipDenomination; count: number }[] = [];
  let remaining = Math.round(amount);
  const sorted = [...denominations].sort((a, b) => b.value - a.value);
  for (const denom of sorted) {
    if (remaining <= 0) break;
    if (denom.value <= 0) continue;
    const count = Math.floor(remaining / denom.value);
    if (count > 0) {
      out.push({ denom, count });
      remaining -= count * denom.value;
    }
  }
  return remaining === 0 ? out : [];
}

/**
 * A compact chip representation capped to a maximum number of visible stacks,
 * used for rendering chips near a seat / pot without overflowing.
 */
export function chipStacks(
  amount: number,
  denominations: ChipDenomination[],
  maxChips = 12,
): ChipDenomination[] {
  const breakdown = chipBreakdown(amount, denominations);
  const chips: ChipDenomination[] = [];
  for (const { denom, count } of breakdown) {
    for (let i = 0; i < count && chips.length < maxChips; i++) {
      chips.push(denom);
    }
  }
  // If exact breakdown failed (custom denominations don't cover it), fall back
  // to a single chip of the largest denomination for a visual hint.
  if (chips.length === 0 && amount > 0 && denominations.length > 0) {
    const largest = [...denominations].sort((a, b) => b.value - a.value)[0];
    chips.push(largest);
  }
  return chips;
}
