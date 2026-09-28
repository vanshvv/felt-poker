import { useMemo, useState } from 'react';
import type { LedgerType } from '@/types';
import { useGameStore } from '@/store/useGameStore';
import { useFmt } from '@/components/common/useFmt';

const LABELS: Record<LedgerType, string> = {
  'buy-in': 'bought in',
  rebuy: 'rebuy',
  'add-on': 'add-on',
  'cash-out': 'cashed out',
  bet: 'bet',
  call: 'called',
  raise: 'raised',
  blind: 'posted blind',
  ante: 'posted ante',
  win: 'won pot',
  refund: 'returned bet',
};

const GROUPS: { key: string; label: string; types: LedgerType[] }[] = [
  { key: 'all', label: 'All', types: [] },
  { key: 'money', label: 'Buy-ins & cash-outs', types: ['buy-in', 'rebuy', 'add-on', 'cash-out'] },
  { key: 'wins', label: 'Wins', types: ['win', 'refund'] },
  { key: 'bets', label: 'Bets', types: ['bet', 'call', 'raise', 'blind', 'ante'] },
];

export function Ledger() {
  const ledger = useGameStore((s) => s.ledger);
  const players = useGameStore((s) => s.players);
  const { fmt } = useFmt();
  const [group, setGroup] = useState('all');
  const [playerId, setPlayerId] = useState<string>('all');

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown';
  const colorOf = (id: string) => players.find((p) => p.id === id)?.color ?? '#888';

  const filtered = useMemo(() => {
    const g = GROUPS.find((x) => x.key === group)!;
    return [...ledger]
      .reverse()
      .filter((e) => (g.types.length ? g.types.includes(e.type) : true))
      .filter((e) => (playerId === 'all' ? true : e.playerId === playerId));
  }, [ledger, group, playerId]);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            className="btn !py-1 !px-2.5 text-xs"
            style={group === g.key ? { borderColor: 'var(--panel-brd-strong)', color: 'var(--gold)' } : undefined}
            onClick={() => setGroup(g.key)}
          >
            {g.label}
          </button>
        ))}
      </div>
      <select
        className="chip-input mb-3"
        value={playerId}
        onChange={(e) => setPlayerId(e.target.value)}
      >
        <option value="all">All players</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {filtered.length === 0 && (
        <div className="text-sm text-[var(--muted-2)] text-center py-8">No transactions yet.</div>
      )}

      <div className="space-y-1">
        {filtered.map((e) => (
          <div key={e.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5">
            <span className="text-[0.62rem] text-[var(--muted-2)] tnum w-12 shrink-0">
              {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf(e.playerId) }} />
            <span className="flex-1 text-sm min-w-0 truncate">
              <span className="font-medium">{nameOf(e.playerId)}</span>{' '}
              <span className="text-[var(--muted)]">{LABELS[e.type]}</span>
              {e.handNumber != null && (
                <span className="text-[0.62rem] text-[var(--muted-2)]"> · #{e.handNumber}</span>
              )}
            </span>
            <span
              className="tnum text-sm font-semibold shrink-0"
              style={{ color: e.amount >= 0 ? 'var(--win)' : 'var(--ink)' }}
            >
              {e.amount >= 0 ? '+' : ''}
              {fmt(e.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
