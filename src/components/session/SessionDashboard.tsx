import { useGameStore, selectAccounting } from '@/store/useGameStore';
import { playerNet, playerValue } from '@/lib/poker';
import { useFmt } from '@/components/common/useFmt';
import { Stat } from '@/components/common/ui';

export function SessionDashboard() {
  const state = useGameStore((s) => s);
  const acct = useGameStore(selectAccounting);
  const { fmt, signed } = useFmt();

  const players = [...state.players].sort((a, b) => playerNet(state, b) - playerNet(state, a));
  const history = state.history;
  const avgPot = history.length ? Math.round(history.reduce((s, h) => s + h.totalPot, 0) / history.length) : 0;
  const largestPot = history.reduce((m, h) => Math.max(m, h.totalPot), 0);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Stat label="Hands played" value={<span className="tnum">{state.handCounter}</span>} />
        <Stat label="Total buy-ins" value={<span className="tnum">{fmt(acct.totalBuyIns)}</span>} />
        <Stat label="Money on table" value={<span className="tnum">{fmt(acct.tableMoney)}</span>} />
        <Stat label="Cashed out" value={<span className="tnum">{fmt(acct.totalCashOut)}</span>} />
        <Stat label="Average pot" value={<span className="tnum">{fmt(avgPot)}</span>} />
        <Stat label="Largest pot" value={<span className="tnum">{fmt(largestPot)}</span>} />
      </div>

      {/* Accounting integrity */}
      <div
        className="rounded-xl px-3.5 py-2.5 mb-4 flex items-center gap-2.5 text-sm"
        style={{
          background: acct.ok ? 'rgba(87,217,138,0.1)' : 'rgba(255,107,107,0.12)',
          border: `1px solid ${acct.ok ? 'rgba(87,217,138,0.3)' : 'rgba(255,107,107,0.4)'}`,
        }}
      >
        <span>{acct.ok ? '✓' : '⚠'}</span>
        {acct.ok ? (
          <span className="text-[var(--muted)]">
            Books balance — net across all players is {signed(acct.netSum)}.
          </span>
        ) : (
          <span>{acct.messages.join(' ')}</span>
        )}
      </div>

      <div className="text-[0.66rem] uppercase tracking-wider text-[var(--muted)] mb-2">
        Player results
      </div>
      <div className="space-y-1.5">
        {players.map((p) => {
          const net = playerNet(state, p);
          const value = playerValue(state, p);
          return (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2"
              style={{ background: 'rgba(0,0,0,0.22)' }}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {p.name}
                  {p.cashedOut != null && (
                    <span className="text-[0.66rem] text-[var(--muted-2)]"> · cashed out</span>
                  )}
                </div>
                <div className="text-[0.68rem] text-[var(--muted)] tnum">
                  {fmt(value)} {p.cashedOut != null ? 'final' : 'now'} · {fmt(p.buyIns)} in
                </div>
              </div>
              <span
                className="tnum font-semibold"
                style={{ color: net >= 0 ? 'var(--win)' : 'var(--loss)' }}
              >
                {signed(net)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
