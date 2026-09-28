import { useEffect, useState } from 'react';
import type { PlayerId, Street } from '@/types';
import {
  useGameStore,
  selectPhase,
  selectAccounting,
  selectNextBlinds,
  dealtPlayers,
} from '@/store/useGameStore';
import { actionablePlayers } from '@/lib/poker';
import { PokerTable, type TableMarks } from './PokerTable';
import { ActionBar } from './ActionBar';
import { ShowdownPanel } from './ShowdownPanel';
import { PlayerModal } from '@/components/player/PlayerModal';
import { SessionDrawer } from '@/components/session/SessionDrawer';
import { Drawer, Field } from '@/components/common/ui';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { useFmt } from '@/components/common/useFmt';

const NEXT_LABEL: Record<Street, string> = {
  preflop: 'Flop',
  flop: 'Turn',
  turn: 'River',
  river: 'Showdown',
  showdown: 'Showdown',
  complete: 'Showdown',
};

function useCompact() {
  const [c, setC] = useState(() => typeof window !== 'undefined' && window.innerWidth < 860);
  useEffect(() => {
    const on = () => setC(window.innerWidth < 860);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return c;
}

export function TableScreen() {
  const compact = useCompact();
  const players = useGameStore((s) => s.players);
  const hand = useGameStore((s) => s.hand);
  const phase = useGameStore(selectPhase);
  const tick = useGameStore((s) => s.animationTick);
  const acct = useGameStore(selectAccounting);
  const nextBlinds = useGameStore(selectNextBlinds);
  const undoStackLen = useGameStore((s) => s.undoStack.length);

  const startNewHand = useGameStore((s) => s.startNewHand);
  const act = useGameStore((s) => s.act);
  const advanceStreet = useGameStore((s) => s.advanceStreet);
  const runOut = useGameStore((s) => s.runOutToShowdown);
  const finalizeShowdown = useGameStore((s) => s.finalizeShowdown);
  const undo = useGameStore((s) => s.undo);
  const undoHand = useGameStore((s) => s.undoHand);

  const { fmt } = useFmt();
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerId | null>(null);
  const [drawer, setDrawer] = useState<null | 'session' | 'settings'>(null);
  const [showAdd, setShowAdd] = useState(false);

  const marks: TableMarks | null = hand
    ? { buttonSeat: hand.buttonSeat, sbSeat: hand.sbSeat, bbSeat: hand.bbSeat }
    : nextBlinds;

  const winnings: Record<PlayerId, number> = {};
  if (hand?.complete) {
    for (const aw of hand.awards)
      for (const w of aw.winners) winnings[w.playerId] = (winnings[w.playerId] ?? 0) + w.amount;
  }

  const toActPlayer =
    hand && hand.toActSeat != null
      ? players.find((p) => p.seat === hand.toActSeat && p.cashedOut == null)
      : null;

  // Keyboard shortcuts for fast operation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'u') undo();
      if ((e.key === 'Enter' || e.key === ' ') && (phase === 'idle' || phase === 'complete')) {
        e.preventDefault();
        startNewHand();
      }
      if (e.key === 'Enter' && phase === 'street-end') advanceStreet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, undo, startNewHand, advanceStreet]);

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 px-3 md:px-5 py-2.5 border-b hair">
        <span className="font-display text-xl md:text-2xl text-[var(--cream)]">♠ Felt</span>
        <span className="hidden sm:block text-xs text-[var(--muted)] tnum">
          {fmt(useGameStore.getState().settings.smallBlind)}/
          {fmt(useGameStore.getState().settings.bigBlind)} · {players.filter((p) => p.cashedOut == null).length} seated
        </span>
        <div className="flex-1" />

        <button
          className="btn btn-ghost !px-2.5 !py-1.5 text-sm"
          onClick={() => setDrawer('session')}
          title="Session, ledger & hand history"
        >
          <span className={acct.ok ? 'text-[var(--win)]' : 'text-[var(--loss)]'}>●</span>
          <span className="hidden sm:inline">Session</span>
        </button>
        <button className="btn btn-ghost !px-2.5 !py-1.5 text-sm" onClick={() => setShowAdd(true)}>
          ＋<span className="hidden sm:inline"> Player</span>
        </button>
        <button
          className="btn btn-ghost !px-2.5 !py-1.5 text-sm"
          onClick={undo}
          disabled={undoStackLen === 0}
          title="Undo last action (u)"
        >
          ↩<span className="hidden sm:inline"> Undo</span>
        </button>
        <button className="btn btn-ghost !px-2.5 !py-1.5 text-sm" onClick={() => setDrawer('settings')}>
          ⚙<span className="hidden sm:inline"> Settings</span>
        </button>
      </header>

      {/* Physical cards banner */}
      <div className="text-center text-[0.62rem] tracking-[0.2em] uppercase text-[var(--muted-2)] py-1">
        Physical cards mode · the deck stays on the table
      </div>

      {!acct.ok && (
        <div className="mx-3 md:mx-5 mb-1 rounded-lg px-3 py-2 text-sm flex items-center gap-2"
          style={{ background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.4)' }}>
          <span>⚠ Accounting error:</span>
          <span className="text-[var(--muted)]">{acct.messages.join(' ')}</span>
        </div>
      )}

      {/* Table */}
      <main className="flex-1 min-h-0 flex items-center justify-center px-2 md:px-6 py-1">
        <div className="w-full" style={{ maxWidth: compact ? 520 : 1040, maxHeight: '100%' }}>
          <PokerTable
            players={players}
            hand={hand}
            toActSeat={hand?.toActSeat ?? null}
            marks={marks}
            winnings={winnings}
            onSelectPlayer={setSelectedPlayer}
            tick={tick}
            compact={compact}
          />
        </div>
      </main>

      {/* Control dock */}
      <footer className="glass border-t hair px-3 md:px-6 py-3 md:py-4">
        <div className="max-w-3xl mx-auto anim-rise" key={phase}>
          <>
            {phase === 'betting' && toActPlayer && hand && (
              <ActionBar hand={hand} player={toActPlayer} onAct={(a) => act(toActPlayer.id, a)} />
            )}

            {phase === 'street-end' && hand && (
              <StreetEndControls
                nextLabel={NEXT_LABEL[hand.street]}
                allInRunout={actionablePlayers(hand).length <= 1 && hand.street !== 'river'}
                onNext={advanceStreet}
                onRunOut={runOut}
              />
            )}

            {phase === 'showdown' && hand && (
              <ShowdownPanel hand={hand} players={players} onFinalize={finalizeShowdown} />
            )}

            {phase === 'complete' && hand && (
              <CompleteControls onNext={startNewHand} onUndoHand={undoHand} />
            )}

            {(phase === 'idle' || phase === 'setup') && (
              <IdleControls
                canDeal={dealtPlayers(players).length >= 2}
                nextBlinds={nextBlinds}
                nameForSeat={(seat) => players.find((p) => p.seat === seat)?.name ?? '—'}
                onDeal={startNewHand}
                onAdd={() => setShowAdd(true)}
              />
            )}
          </>
        </div>
      </footer>

      {/* Overlays */}
      {selectedPlayer && (
        <PlayerModal playerId={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}
      {showAdd && <AddPlayerModal onClose={() => setShowAdd(false)} />}

      <Drawer open={drawer === 'session'} onClose={() => setDrawer(null)} title="Session">
        <SessionDrawer />
      </Drawer>
      <Drawer open={drawer === 'settings'} onClose={() => setDrawer(null)} title="Game settings">
        <SettingsPanel />
      </Drawer>
    </div>
  );
}

function IdleControls({
  canDeal,
  nextBlinds,
  nameForSeat,
  onDeal,
  onAdd,
}: {
  canDeal: boolean;
  nextBlinds: { buttonSeat: number; sbSeat: number; bbSeat: number } | null;
  nameForSeat: (seat: number) => string;
  onDeal: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      {canDeal && nextBlinds ? (
        <>
          <div className="text-xs text-[var(--muted)] text-center">
            Dealer <b className="text-[var(--cream)]">{nameForSeat(nextBlinds.buttonSeat)}</b> · SB{' '}
            {nameForSeat(nextBlinds.sbSeat)} · BB {nameForSeat(nextBlinds.bbSeat)}
          </div>
          <button className="btn btn-gold btn-lg px-12" onClick={onDeal}>
            ♠ Deal Hand
          </button>
        </>
      ) : (
        <>
          <div className="text-sm text-[var(--muted)]">Add at least two funded players to deal.</div>
          <button className="btn btn-gold btn-lg px-8" onClick={onAdd}>
            ＋ Add Player
          </button>
        </>
      )}
    </div>
  );
}

function StreetEndControls({
  nextLabel,
  allInRunout,
  onNext,
  onRunOut,
}: {
  nextLabel: string;
  allInRunout: boolean;
  onNext: () => void;
  onRunOut: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-xs text-[var(--muted)]">
        Betting complete — deal the {nextLabel.toLowerCase()} cards, then continue.
      </div>
      <div className="flex gap-2">
        <button className="btn btn-gold btn-lg px-10" onClick={onNext}>
          Next: {nextLabel} →
        </button>
        {allInRunout && (
          <button className="btn btn-lg" onClick={onRunOut}>
            Run it out ⏭
          </button>
        )}
      </div>
    </div>
  );
}

function CompleteControls({ onNext, onUndoHand }: { onNext: () => void; onUndoHand: () => void }) {
  const hand = useGameStore((s) => s.hand);
  const players = useGameStore((s) => s.players);
  const { fmt } = useFmt();
  if (!hand) return null;
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? '—';
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-center">
        {hand.awards.map((aw, i) => (
          <div key={i} className="text-sm">
            <span className="text-[var(--muted)]">{hand.awards.length > 1 ? `${aw.potLabel}: ` : ''}</span>
            {aw.winners.map((w, j) => (
              <span key={j} className="font-semibold text-[var(--win)]">
                {j > 0 && ' · '}
                {nameOf(w.playerId)} wins {fmt(w.amount)}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button className="btn btn-gold btn-lg px-12" onClick={onNext}>
          Next Hand ♠
        </button>
        <button className="btn btn-ghost" onClick={onUndoHand} title="Undo the whole hand">
          ↩ Undo hand
        </button>
      </div>
    </div>
  );
}

function AddPlayerModal({ onClose }: { onClose: () => void }) {
  const addPlayer = useGameStore((s) => s.addPlayer);
  const buyInDefault = useGameStore((s) => s.settings.startingBuyIn);
  const { fmt } = useFmt();
  const [name, setName] = useState('');
  const [buyIn, setBuyIn] = useState(buyInDefault);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="glass anim-pop relative w-full max-w-sm rounded-2xl p-5">
        <h2 className="font-display text-xl text-[var(--cream)] mb-4">Add player</h2>
        <div className="space-y-3">
          <Field label="Name">
            <input
              autoFocus
              className="chip-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addPlayer({ name, buyIn });
                  onClose();
                }
              }}
            />
          </Field>
          <Field label={`Buy-in (${fmt(buyIn)})`}>
            <input
              type="number"
              className="chip-input tnum"
              value={buyIn}
              onChange={(e) => setBuyIn(parseInt(e.target.value, 10) || 0)}
            />
          </Field>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="btn btn-ghost flex-1" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-gold flex-1"
            onClick={() => {
              addPlayer({ name, buyIn });
              onClose();
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
