/**
 * Dealer button and blind position logic.
 *
 * Seats are integer indices around the table. "Occupied" here means the seats
 * of players who are being dealt into the hand (not sitting out, with chips).
 * Everything rotates clockwise = ascending seat index, wrapping around.
 */

/** Seats ordered clockwise starting *after* `fromSeat` (exclusive), wrapping. */
export function seatsAfter(occupied: number[], fromSeat: number): number[] {
  const sorted = [...occupied].sort((a, b) => a - b);
  const after = sorted.filter((s) => s > fromSeat);
  const before = sorted.filter((s) => s <= fromSeat);
  return [...after, ...before];
}

/** The next occupied seat clockwise from `fromSeat`. */
export function nextOccupiedSeat(occupied: number[], fromSeat: number): number {
  const order = seatsAfter(occupied, fromSeat);
  return order.length > 0 ? order[0] : fromSeat;
}

/** Advance the button to the next occupied seat clockwise. */
export function rotateButton(occupied: number[], currentButton: number): number {
  if (occupied.length === 0) return currentButton;
  if (!occupied.includes(currentButton)) {
    // Button seat left the table; place it on the first seat at/after it.
    return nextOccupiedSeat(occupied, currentButton - 1);
  }
  return nextOccupiedSeat(occupied, currentButton);
}

/**
 * Decide the button seat for the next hand, shared by the store and the UI
 * preview so they never disagree. First hand: the lowest occupied seat.
 * Otherwise rotate when auto-rotation is on, else keep it (repositioning only
 * if that seat emptied).
 */
export function planButton(
  occupied: number[],
  buttonSeat: number | null,
  autoRotate: boolean,
): number {
  if (occupied.length === 0) return buttonSeat ?? 0;
  if (buttonSeat == null) return occupied[0];
  if (autoRotate) return rotateButton(occupied, buttonSeat);
  return occupied.includes(buttonSeat) ? buttonSeat : rotateButton(occupied, buttonSeat);
}

export interface BlindSeats {
  sbSeat: number;
  bbSeat: number;
}

/**
 * Given the occupied seats and the button, determine small-blind and big-blind
 * seats. Handles heads-up (2 players) where the button posts the small blind.
 */
export function computeBlindSeats(occupied: number[], buttonSeat: number): BlindSeats {
  if (occupied.length < 2) {
    return { sbSeat: buttonSeat, bbSeat: buttonSeat };
  }
  if (occupied.length === 2) {
    // Heads-up: button is the small blind, the other player is the big blind.
    const other = occupied.find((s) => s !== buttonSeat)!;
    return { sbSeat: buttonSeat, bbSeat: other };
  }
  const sbSeat = nextOccupiedSeat(occupied, buttonSeat);
  const bbSeat = nextOccupiedSeat(occupied, sbSeat);
  return { sbSeat, bbSeat };
}

/**
 * The seat of the player who acts first preflop (the player left of the big
 * blind — "under the gun"). Heads-up, the button/SB acts first preflop.
 */
export function firstToActPreflop(occupied: number[], bbSeat: number, buttonSeat: number): number {
  if (occupied.length === 2) return buttonSeat;
  return nextOccupiedSeat(occupied, bbSeat);
}

/**
 * The seat of the player who acts first on postflop streets — the first
 * still-in player left of the button. Heads-up, the big blind acts first.
 */
export function firstToActPostflop(occupied: number[], buttonSeat: number): number {
  return nextOccupiedSeat(occupied, buttonSeat);
}
