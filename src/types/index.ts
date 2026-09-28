/**
 * Core domain model for the poker chip / table simulator.
 *
 * Design notes:
 * - All monetary amounts are integers in "currency units" (e.g. whole rupees).
 *   We never use floats for money; odd-chip remainders are distributed as whole
 *   units by the settlement engine. This keeps every accounting invariant exact.
 * - The betting engine (lib/poker/**) operates on plain data and pure functions.
 *   It has no dependency on React or the store.
 */

export type PlayerId = string;

/** A player's lifetime state within a session (persists across hands). */
export interface Player {
  id: PlayerId;
  name: string;
  /** Accent color for the seat. */
  color: string;
  /** Seat index around the table (0-based). Empty seats are simply absent. */
  seat: number;
  /** Chips currently in front of the player (their stack). */
  stack: number;
  /** Total money brought to the table this session (initial buy-in + rebuys + add-ons). */
  buyIns: number;
  /** If the player has cashed out, the chip value they left with; otherwise null. */
  cashedOut: number | null;
  /** True when the player is sitting out (not dealt into new hands). */
  sittingOut: boolean;
}

/** A player's status within the currently-running hand. */
export type HandPlayerStatus = 'active' | 'folded' | 'allin';

/** Per-hand snapshot of a player who was dealt into the current hand. */
export interface HandPlayer {
  id: PlayerId;
  seat: number;
  /** Stack the player had at the moment the hand started. */
  startingStack: number;
  /** Chips currently in front of the player during the hand. */
  stack: number;
  /** Chips committed by this player on the current street only. */
  streetCommitted: number;
  /** Chips committed by this player across the whole hand (incl. antes/blinds). */
  handCommitted: number;
  status: HandPlayerStatus;
  /**
   * Whether the player has acted since the last aggressive action on this street.
   * Reset to false at the start of each street and when betting is re-opened.
   */
  hasActed: boolean;
  /**
   * Whether the player is currently permitted to raise. Set false when an
   * all-in that is smaller than a full raise fails to re-open the betting for
   * players who have already acted (incomplete-raise rule).
   */
  mayRaise: boolean;
}

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'complete';

export type ActionType =
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'allin'
  | 'post-sb'
  | 'post-bb'
  | 'post-ante';

/** A single recorded action inside a hand (used for hand history & replay). */
export interface HandAction {
  playerId: PlayerId;
  type: ActionType;
  /** The amount added to the pot by this action (the chips that moved). */
  amount: number;
  /** The player's total street commitment after this action (for "raise to X"). */
  toAmount: number;
  street: Street;
  timestamp: number;
}

/** A pot (main or side) with its eligible players and contribution level. */
export interface Pot {
  id: string;
  amount: number;
  /** Player ids eligible to win this pot (folded players are excluded). */
  eligible: PlayerId[];
  /** The per-player contribution ceiling that formed this layer. */
  level: number;
  /** Human label, e.g. "Main Pot", "Side Pot 1". */
  label: string;
}

/** Result of distributing a single pot to one or more winners. */
export interface PotAward {
  potId: string;
  potLabel: string;
  winners: { playerId: PlayerId; amount: number }[];
}

export interface HandState {
  id: string;
  handNumber: number;
  street: Street;
  /** Players in the hand, ordered by seat ascending. */
  players: HandPlayer[];
  buttonSeat: number;
  sbSeat: number;
  bbSeat: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  /** Highest street commitment this street (the amount to call up to). */
  currentBet: number;
  /** Size of the last full bet/raise increment; drives the minimum-raise rule. */
  lastRaiseSize: number;
  /** Seat of the player whose turn it is to act, or null if no one may act. */
  toActSeat: number | null;
  /** Pots as computed from committed chips (recomputed after each action). */
  pots: Pot[];
  actions: HandAction[];
  /** Awards made at showdown (populated during resolution). */
  awards: PotAward[];
  /** True once the pot(s) have been fully distributed and the hand is closed. */
  complete: boolean;
}

export type RemainderRule = 'closest-to-button';

export interface ChipDenomination {
  value: number;
  /** CSS color for the chip face. */
  color: string;
}

export interface GameSettings {
  variant: string;
  currency: string;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  startingBuyIn: number;
  /** Default rebuy amount offered in the UI. */
  defaultRebuy: number;
  minRaiseRule: 'standard';
  remainderRule: RemainderRule;
  autoRotateDealer: boolean;
  chipDenominations: ChipDenomination[];
  maxSeats: number;
}

export type LedgerType =
  | 'buy-in'
  | 'rebuy'
  | 'add-on'
  | 'cash-out'
  | 'bet'
  | 'call'
  | 'raise'
  | 'blind'
  | 'ante'
  | 'win'
  | 'refund';

/** A single line in the money ledger. */
export interface LedgerEntry {
  id: string;
  timestamp: number;
  playerId: PlayerId;
  type: LedgerType;
  /** Signed change to the player's stack/table money. */
  amount: number;
  handNumber: number | null;
  note?: string;
}

/** A completed hand saved to history. */
export interface HandHistoryEntry {
  handNumber: number;
  timestamp: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  buttonPlayerId: PlayerId | null;
  playerNames: Record<PlayerId, string>;
  seats: { playerId: PlayerId; startingStack: number; net: number }[];
  actions: HandAction[];
  awards: PotAward[];
  totalPot: number;
  winners: PlayerId[];
}

export interface AccountingReport {
  ok: boolean;
  /** Total money bought into the session. */
  totalBuyIns: number;
  /** Chips currently on the table (in stacks + live pots). */
  tableMoney: number;
  /** Total cashed out. */
  totalCashOut: number;
  /** Sum of all players' net results (should be 0). */
  netSum: number;
  messages: string[];
}

export interface GameState {
  settings: GameSettings;
  players: Player[];
  hand: HandState | null;
  ledger: LedgerEntry[];
  history: HandHistoryEntry[];
  handCounter: number;
  /** Seat of the dealer button (persists between hands so it can rotate). */
  buttonSeat: number | null;
  /** Whether the initial setup has been completed. */
  started: boolean;
  createdAt: number;
}

/** Live phase of the current hand, derived for the UI. */
export type HandPhase =
  | 'setup' // fewer than 2 seated players
  | 'idle' // between hands, ready to deal
  | 'betting' // a player is to act
  | 'street-end' // betting round done, awaiting Next Street
  | 'showdown' // awaiting winner selection
  | 'complete'; // hand resolved, ready for next
