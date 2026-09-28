import { useState } from 'react';
import { SessionDashboard } from './SessionDashboard';
import { Ledger } from './Ledger';
import { HandHistory } from './HandHistory';

const TABS = [
  { key: 'results', label: 'Results' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'hands', label: 'Hands' },
] as const;

export function SessionDrawer() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('results');
  return (
    <div>
      <div className="flex gap-1.5 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            className="btn !py-1.5 flex-1 text-sm"
            style={tab === t.key ? { borderColor: 'var(--panel-brd-strong)', color: 'var(--gold)' } : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'results' && <SessionDashboard />}
      {tab === 'ledger' && <Ledger />}
      {tab === 'hands' && <HandHistory />}
    </div>
  );
}
