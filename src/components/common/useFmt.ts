import { useGameStore } from '@/store/useGameStore';
import { chipStacks, formatMoney, formatSigned } from '@/lib/poker';

/** Formatting helpers bound to the current currency and chip denominations. */
export function useFmt() {
  const currency = useGameStore((s) => s.settings.currency);
  const denoms = useGameStore((s) => s.settings.chipDenominations);
  return {
    currency,
    fmt: (n: number) => formatMoney(n, currency),
    signed: (n: number) => formatSigned(n, currency),
    chipsFor: (n: number, max = 10) =>
      chipStacks(n, denoms, max).map((d) => ({ color: d.color, value: d.value })),
  };
}
