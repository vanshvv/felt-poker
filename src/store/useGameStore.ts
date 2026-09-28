import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ActionType,
  GameSettings,
  GameState,
  HandHistoryEntry,
  HandPhase,
  LedgerEntry,
  LedgerType,
  Player,
  PlayerId,
} from '@/types';
import {
  applyAction,
  advanceStreet as engineAdvanceStreet,
  computeBlindSeats,
  finalizeHand,
  isBettingRoundComplete,
  onlyOneContender,
  planButton,
  resolveUncontested,
  startHand,
  uid,
  validateAccounting,
  validateAction,
  type ActionInput,
  type ShowdownSelection,
} from '@/lib/poker';
import { DEFAULT_SETTINGS, MAX_UNDO, SEAT_COLORS } from '@/lib/constants';

/** The persistable core of the game (everything except transient UI/undo). */
type Core = GameState;

interface Transient {
  /** Structural-sharing snapshots of core state for single-step undo. */
  undoStack: Core[];
  /** State captured just before the current hand started (for "undo hand"). */
  preHandSnapshot: Core | null;
  /** Last validation / operation error, shown transiently in the UI. */
  error: string | null;
  /** Bumps whenever chips visually move, so the UI can trigger animations. */
  animationTick: number;
}

interface Actions {
  // setup / players
  updateSettings: (patch: Partial<GameSettings>) => void;
  addPlayer: (input: { name: string; buyIn: number; color?: string; seat?: number }) => void;
  editPlayer: (id: PlayerId, patch: Partial<Pick<Player, 'name' | 'color'>>) => void;
  movePlayer: (id: PlayerId, seat: number) => void;
  removePlayer: (id: PlayerId) => void;
  setSittingOut: (id: PlayerId, sittingOut: boolean) => void;
  beginSession: () => void;
  // money
  rebuy: (id: PlayerId, amount: number) => void;
  cashOut: (id: PlayerId, amount?: number) => void;
  // dealer
  setButton: (seat: number) => void;
  // hand lifecycle
  startNewHand: () => void;
  act: (playerId: PlayerId, action: ActionInput) => void;
  advanceStreet: () => void;
  runOutToShowdown: () => void;
  finalizeShowdown: (selections: ShowdownSelection[]) => void;
  // undo / session
  undo: () => void;
  undoHand: () => void;
  clearError: () => void;
  resetSession: (keepPlayers?: boolean) => void;
  importSession: (data: unknown) => boolean;
  exportSession: () => string;
}

export type Store = Core & Transient & Actions;

function freshCore(): Core {
  return {
    settings: DEFAULT_SETTINGS,
    players: [],
    hand: null,
    ledger: [],
    history: [],
    handCounter: 0,
    buttonSeat: null,
    started: false,
    createdAt: Date.now(),
  };
}

/** Shallow snapshot — safe because every mutation replaces (never mutates). */
function snapshotOf(s: Core): Core {
  return {
    settings: s.settings,
    players: s.players,
    hand: s.hand,
    ledger: s.ledger,
    history: s.history,
    handCounter: s.handCounter,
    buttonSeat: s.buttonSeat,
    started: s.started,
    createdAt: s.createdAt,
  };
}

/** Players eligible to be dealt into a hand. */
export function dealtPlayers(players: Player[]): Player[] {
  return players
    .filter((p) => p.cashedOut == null && !p.sittingOut && p.stack > 0)
    .sort((a, b) => a.seat - b.seat);
}

/** Copy live stacks from a hand back onto the session players. */
function syncStacks(players: Player[], handPlayers: { id: PlayerId; stack: number }[]): Player[] {
  const map = new Map(handPlayers.map((hp) => [hp.id, hp.stack]));
  return players.map((p) => (map.has(p.id) ? { ...p, stack: map.get(p.id)! } : p));
}

function ledgerEntry(
  playerId: PlayerId,
  type: LedgerType,
  amount: number,
  handNumber: number | null,
  note?: string,
): LedgerEntry {
  return { id: uid('lg'), timestamp: Date.now(), playerId, type, amount, handNumber, ...(note ? { note } : {}) };
}

/** Emit ledger lines for every player whose stack changed between snapshots. */
function deltaLedger(
  before: Map<PlayerId, number>,
  after: Player[],
  negType: LedgerType,
  posType: LedgerType,
  handNumber: number | null,
): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const p of after) {
    const prev = before.get(p.id);
    if (prev == null) continue;
    const delta = p.stack - prev;
    if (delta === 0) continue;
    out.push(ledgerEntry(p.id, delta > 0 ? posType : negType, delta, handNumber));
  }
  return out;
}

function stacksMap(players: Player[]): Map<PlayerId, number> {
  return new Map(players.map((p) => [p.id, p.stack]));
}

function nextFreeSeat(players: Player[], maxSeats: number): number {
  const taken = new Set(players.map((p) => p.seat));
  for (let i = 0; i < maxSeats; i++) if (!taken.has(i)) return i;
  return players.length;
}

function pushUndo(stack: Core[], snap: Core): Core[] {
  const next = [...stack, snap];
  return next.length > MAX_UNDO ? next.slice(next.length - MAX_UNDO) : next;
}

export const useGameStore = create<Store>()(
  persist(
    (set, get) => ({
      ...freshCore(),
      undoStack: [],
      preHandSnapshot: null,
      error: null,
      animationTick: 0,

      updateSettings: (patch) =>
        set((s) => ({
          undoStack: pushUndo(s.undoStack, snapshotOf(s)),
          settings: { ...s.settings, ...patch },
        })),

      addPlayer: ({ name, buyIn, color, seat }) =>
        set((s) => {
          if (s.hand && !s.hand.complete) {
            return { error: 'Finish the current hand before adding a player.' };
          }
          const finalSeat = seat ?? nextFreeSeat(s.players, s.settings.maxSeats);
          if (s.players.some((p) => p.seat === finalSeat)) {
            return { error: 'That seat is taken.' };
          }
          const player: Player = {
            id: uid('pl'),
            name: name.trim() || `Player ${s.players.length + 1}`,
            color: color ?? SEAT_COLORS[s.players.length % SEAT_COLORS.length],
            seat: finalSeat,
            stack: buyIn,
            buyIns: buyIn,
            cashedOut: null,
            sittingOut: false,
          };
          return {
            undoStack: pushUndo(s.undoStack, snapshotOf(s)),
            players: [...s.players, player],
            ledger: [...s.ledger, ledgerEntry(player.id, 'buy-in', buyIn, null, 'Initial buy-in')],
            error: null,
          };
        }),

      beginSession: () => set({ started: true, error: null }),

      editPlayer: (id, patch) =>
        set((s) => ({
          undoStack: pushUndo(s.undoStack, snapshotOf(s)),
          players: s.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      movePlayer: (id, seat) =>
        set((s) => {
          if (s.hand && !s.hand.complete) return { error: 'Cannot move seats during a hand.' };
          if (s.players.some((p) => p.seat === seat && p.id !== id)) {
            return { error: 'That seat is taken.' };
          }
          return {
            undoStack: pushUndo(s.undoStack, snapshotOf(s)),
            players: s.players.map((p) => (p.id === id ? { ...p, seat } : p)),
            error: null,
          };
        }),

      removePlayer: (id) =>
        set((s) => {
          if (s.hand && !s.hand.complete) return { error: 'Finish the current hand first.' };
          const player = s.players.find((p) => p.id === id);
          if (!player) return {};
          const playedAHand = s.history.some((h) => h.seats.some((seat) => seat.playerId === id));
          if (playedAHand && player.cashedOut == null) {
            return {
              error: 'This player has played hands — cash them out instead of removing.',
            };
          }
          // Safe to delete: reverse their buy-in ledger lines too so accounting stays clean.
          return {
            undoStack: pushUndo(s.undoStack, snapshotOf(s)),
            players: s.players.filter((p) => p.id !== id),
            ledger: s.ledger.filter((l) => l.playerId !== id),
            error: null,
          };
        }),

      setSittingOut: (id, sittingOut) =>
        set((s) => {
          if (s.hand && !s.hand.complete) {
            return { error: 'Change sit-out status between hands.' };
          }
          return {
            undoStack: pushUndo(s.undoStack, snapshotOf(s)),
            players: s.players.map((p) => (p.id === id ? { ...p, sittingOut } : p)),
            error: null,
          };
        }),

      rebuy: (id, amount) =>
        set((s) => {
          if (amount <= 0) return { error: 'Rebuy must be positive.' };
          if (s.hand && !s.hand.complete) {
            const hp = s.hand.players.find((p) => p.id === id);
            if (hp && hp.status !== 'folded') {
              return { error: 'Rebuy is available between hands or after folding.' };
            }
          }
          return {
            undoStack: pushUndo(s.undoStack, snapshotOf(s)),
            players: s.players.map((p) => {
              if (p.id !== id) return p;
              const reentry = p.cashedOut != null;
              return {
                ...p,
                stack: reentry ? amount : p.stack + amount,
                buyIns: p.buyIns + amount,
                cashedOut: null,
              };
            }),
            ledger: [...s.ledger, ledgerEntry(id, 'rebuy', amount, s.hand?.handNumber ?? null, 'Rebuy')],
            error: null,
          };
        }),

      cashOut: (id, amount) =>
        set((s) => {
          if (s.hand && !s.hand.complete) {
            const hp = s.hand.players.find((p) => p.id === id);
            if (hp && hp.status !== 'folded') {
              return { error: 'Cash out between hands or after folding.' };
            }
          }
          const player = s.players.find((p) => p.id === id);
          if (!player) return {};
          const value = amount ?? player.stack;
          return {
            undoStack: pushUndo(s.undoStack, snapshotOf(s)),
            players: s.players.map((p) =>
              p.id === id ? { ...p, cashedOut: value, sittingOut: true } : p,
            ),
            ledger: [
              ...s.ledger,
              ledgerEntry(id, 'cash-out', -value, s.hand?.handNumber ?? null, 'Cashed out'),
            ],
            error: null,
          };
        }),

      setButton: (seat) =>
        set((s) => {
          if (s.hand && !s.hand.complete) return { error: 'Cannot move the button mid-hand.' };
          return { undoStack: pushUndo(s.undoStack, snapshotOf(s)), buttonSeat: seat, error: null };
        }),

      startNewHand: () =>
        set((s) => {
          if (s.hand && !s.hand.complete) return { error: 'The current hand is still in progress.' };
          const dealt = dealtPlayers(s.players);
          if (dealt.length < 2) return { error: 'Need at least 2 players with chips to deal.' };

          const occupied = dealt.map((p) => p.seat);
          const button = planButton(occupied, s.buttonSeat, s.settings.autoRotateDealer);

          const hand = startHand({
            handNumber: s.handCounter + 1,
            seats: dealt.map((p) => ({ id: p.id, seat: p.seat, stack: p.stack })),
            buttonSeat: button,
            smallBlind: s.settings.smallBlind,
            bigBlind: s.settings.bigBlind,
            ante: s.settings.ante,
          });

          const players = syncStacks(s.players, hand.players);
          const blindLines: LedgerEntry[] = hand.actions
            .filter((a) => a.type.startsWith('post-'))
            .map((a) =>
              ledgerEntry(
                a.playerId,
                a.type === 'post-ante' ? 'ante' : 'blind',
                -a.amount,
                hand.handNumber,
                a.type === 'post-sb' ? 'Small blind' : a.type === 'post-bb' ? 'Big blind' : 'Ante',
              ),
            );

          return {
            preHandSnapshot: snapshotOf(s),
            undoStack: pushUndo(s.undoStack, snapshotOf(s)),
            hand,
            players,
            buttonSeat: button,
            handCounter: s.handCounter + 1,
            ledger: [...s.ledger, ...blindLines],
            started: true,
            error: null,
            animationTick: s.animationTick + 1,
          };
        }),

      act: (playerId, action) => {
        const s = get();
        if (!s.hand || s.hand.complete) return;
        const v = validateAction(s.hand, playerId, action);
        if (!v.ok) {
          set({ error: v.error ?? 'Illegal action.' });
          return;
        }
        const before = stacksMap(s.players);
        const newHand = applyAction(s.hand, playerId, action);
        const players = syncStacks(s.players, newHand.players);
        const negType = ledgerTypeForAction(action.type, s.hand.currentBet);
        const lines = negType ? deltaLedger(before, players, negType, 'refund', newHand.handNumber) : [];

        set((st) => ({
          undoStack: pushUndo(st.undoStack, snapshotOf(st)),
          hand: newHand,
          players,
          ledger: [...st.ledger, ...lines],
          error: null,
          animationTick: st.animationTick + (lines.length ? 1 : 0),
        }));

        // Everyone folded to one player — resolve immediately (no extra undo step).
        if (onlyOneContender(newHand) && !newHand.complete) {
          resolveAndRecord(get, set, resolveUncontested(newHand));
        }
      },

      advanceStreet: () =>
        set((s) => {
          if (!s.hand || s.hand.complete) return {};
          if (s.hand.toActSeat != null) return { error: 'Betting is not complete for this street.' };
          const before = stacksMap(s.players);
          const newHand = engineAdvanceStreet(s.hand);
          const players = syncStacks(s.players, newHand.players);
          const lines = deltaLedger(before, players, 'refund', 'refund', newHand.handNumber);
          return {
            undoStack: pushUndo(s.undoStack, snapshotOf(s)),
            hand: newHand,
            players,
            ledger: [...s.ledger, ...lines],
            error: null,
            animationTick: s.animationTick + 1,
          };
        }),

      runOutToShowdown: () =>
        set((s) => {
          if (!s.hand || s.hand.complete) return {};
          if (s.hand.toActSeat != null) return { error: 'Players still have to act.' };
          const before = stacksMap(s.players);
          let h = s.hand;
          let guard = 0;
          while (h.street !== 'showdown' && h.street !== 'complete' && guard++ < 6) {
            h = engineAdvanceStreet(h);
          }
          const players = syncStacks(s.players, h.players);
          const lines = deltaLedger(before, players, 'refund', 'refund', h.handNumber);
          return {
            undoStack: pushUndo(s.undoStack, snapshotOf(s)),
            hand: h,
            players,
            ledger: [...s.ledger, ...lines],
            error: null,
            animationTick: s.animationTick + 1,
          };
        }),

      finalizeShowdown: (selections) => {
        const s = get();
        if (!s.hand || s.hand.complete) return;
        resolveAndRecord(get, set, finalizeHand(s.hand, selections), true);
      },

      undo: () =>
        set((s) => {
          if (s.undoStack.length === 0) return { error: 'Nothing to undo.' };
          const prev = s.undoStack[s.undoStack.length - 1];
          return { ...prev, undoStack: s.undoStack.slice(0, -1), error: null };
        }),

      undoHand: () =>
        set((s) => {
          if (!s.preHandSnapshot) return { error: 'No hand to undo.' };
          return {
            ...s.preHandSnapshot,
            undoStack: pushUndo(s.undoStack, snapshotOf(s)),
            preHandSnapshot: null,
            error: null,
          };
        }),

      clearError: () => set({ error: null }),

      resetSession: (keepPlayers = false) =>
        set((s) => {
          const base = freshCore();
          if (keepPlayers) {
            base.settings = s.settings;
            base.players = s.players.map((p) => ({
              ...p,
              stack: p.buyIns,
              cashedOut: null,
              sittingOut: false,
            }));
            base.started = s.players.length > 0;
          }
          return { ...base, undoStack: [], preHandSnapshot: null, error: null };
        }),

      importSession: (data) => {
        if (!isValidCore(data)) {
          set({ error: 'That file is not a valid Felt session.' });
          return false;
        }
        set({ ...data, undoStack: [], preHandSnapshot: null, error: null });
        return true;
      },

      exportSession: () => {
        const s = get();
        return JSON.stringify(snapshotOf(s), null, 2);
      },
    }),
    {
      name: 'felt-poker-v1',
      partialize: (s) => {
        const core = snapshotOf(s);
        // Persist a single pre-hand snapshot too (small); skip the undo stack.
        return { ...core, preHandSnapshot: s.preHandSnapshot } as unknown as Store;
      },
    },
  ),
);

/** Apply a resolved (complete) hand: sync stacks, record wins, push history. */
function resolveAndRecord(
  get: () => Store,
  set: (partial: Partial<Store> | ((s: Store) => Partial<Store>)) => void,
  done: ReturnType<typeof finalizeHand>,
  snapshot = false,
) {
  const s = get();
  const before = stacksMap(s.players);
  const players = syncStacks(s.players, done.players);
  const winLines = deltaLedger(before, players, 'refund', 'win', done.handNumber);
  const history = [...s.history, buildHistory(done, s.players)];
  set((st) => ({
    ...(snapshot ? { undoStack: pushUndo(st.undoStack, snapshotOf(st)) } : {}),
    hand: done,
    players,
    ledger: [...st.ledger, ...winLines],
    history,
    error: null,
    animationTick: st.animationTick + 1,
  }));
}

function buildHistory(done: ReturnType<typeof finalizeHand>, players: Player[]): HandHistoryEntry {
  const nameMap: Record<PlayerId, string> = {};
  for (const p of players) nameMap[p.id] = p.name;
  const buttonPlayer = done.players.find((p) => p.seat === done.buttonSeat);
  const winners = new Set<PlayerId>();
  let totalPot = 0;
  for (const award of done.awards) {
    for (const w of award.winners) {
      winners.add(w.playerId);
      totalPot += w.amount;
    }
  }
  return {
    handNumber: done.handNumber,
    timestamp: Date.now(),
    smallBlind: done.smallBlind,
    bigBlind: done.bigBlind,
    ante: done.ante,
    buttonPlayerId: buttonPlayer?.id ?? null,
    playerNames: nameMap,
    seats: done.players.map((p) => ({
      playerId: p.id,
      startingStack: p.startingStack,
      net: p.stack - p.startingStack,
    })),
    actions: done.actions,
    awards: done.awards,
    totalPot,
    winners: [...winners],
  };
}

function ledgerTypeForAction(type: ActionType, currentBet: number): LedgerType | null {
  switch (type) {
    case 'call':
      return 'call';
    case 'bet':
      return 'bet';
    case 'raise':
      return 'raise';
    case 'allin':
      return currentBet > 0 ? 'raise' : 'bet';
    default:
      return null; // fold / check move no chips
  }
}

function isValidCore(data: unknown): data is Core {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    'settings' in d &&
    'players' in d &&
    Array.isArray(d.players) &&
    'ledger' in d &&
    'history' in d
  );
}

/* -------------------------------------------------------------------------- */
/*  Derived selectors                                                          */
/* -------------------------------------------------------------------------- */

export function selectPhase(s: Store): HandPhase {
  const seated = s.players.filter((p) => p.cashedOut == null);
  if (!s.hand) return seated.length < 2 ? 'setup' : 'idle';
  if (s.hand.complete) return 'complete';
  if (s.hand.street === 'showdown') return 'showdown';
  if (s.hand.toActSeat != null) return 'betting';
  return 'street-end';
}

export function selectAccounting(s: Store) {
  return validateAccounting(s);
}

/** Preview of the button + blind seats for the next hand (or null if not dealable). */
export function selectNextBlinds(
  s: Store,
): { buttonSeat: number; sbSeat: number; bbSeat: number } | null {
  const dealt = dealtPlayers(s.players);
  if (dealt.length < 2) return null;
  const occupied = dealt.map((p) => p.seat);
  const buttonSeat = planButton(occupied, s.buttonSeat, s.settings.autoRotateDealer);
  const { sbSeat, bbSeat } = computeBlindSeats(occupied, buttonSeat);
  return { buttonSeat, sbSeat, bbSeat };
}

export { isBettingRoundComplete, onlyOneContender };
