import { describe, it, expect } from 'vitest';
import {
  computeBlindSeats,
  firstToActPostflop,
  firstToActPreflop,
  nextOccupiedSeat,
  rotateButton,
  seatsAfter,
} from './rotation';

describe('seat traversal', () => {
  it('lists seats clockwise from a point, wrapping', () => {
    expect(seatsAfter([0, 1, 2, 3], 1)).toEqual([2, 3, 0, 1]);
    expect(seatsAfter([0, 1, 2, 3], 3)).toEqual([0, 1, 2, 3]);
  });

  it('finds the next occupied seat with gaps', () => {
    expect(nextOccupiedSeat([0, 2, 5], 2)).toBe(5);
    expect(nextOccupiedSeat([0, 2, 5], 5)).toBe(0);
  });
});

describe('rotateButton', () => {
  it('advances clockwise to the next occupied seat', () => {
    expect(rotateButton([0, 1, 2, 3], 0)).toBe(1);
    expect(rotateButton([0, 1, 2, 3], 3)).toBe(0);
  });

  it('skips empty seats', () => {
    expect(rotateButton([0, 2, 5], 2)).toBe(5);
    expect(rotateButton([0, 2, 5], 5)).toBe(0);
  });

  it('repositions the button if its seat left the table', () => {
    expect(rotateButton([0, 2, 5], 3)).toBe(5);
  });
});

describe('computeBlindSeats', () => {
  it('assigns SB then BB clockwise from the button (full ring)', () => {
    expect(computeBlindSeats([0, 1, 2, 3, 4, 5], 0)).toEqual({ sbSeat: 1, bbSeat: 2 });
    expect(computeBlindSeats([0, 1, 2, 3, 4, 5], 5)).toEqual({ sbSeat: 0, bbSeat: 1 });
  });

  it('handles heads-up: the button posts the small blind', () => {
    expect(computeBlindSeats([2, 5], 2)).toEqual({ sbSeat: 2, bbSeat: 5 });
    expect(computeBlindSeats([2, 5], 5)).toEqual({ sbSeat: 5, bbSeat: 2 });
  });

  it('skips empty seats when assigning blinds', () => {
    expect(computeBlindSeats([0, 3, 6], 0)).toEqual({ sbSeat: 3, bbSeat: 6 });
  });
});

describe('first to act', () => {
  it('preflop: UTG (left of BB) in a full ring', () => {
    expect(firstToActPreflop([0, 1, 2, 3], 2, 0)).toBe(3);
  });

  it('preflop heads-up: the button/SB acts first', () => {
    expect(firstToActPreflop([2, 5], 5, 2)).toBe(2);
  });

  it('postflop: first player left of the button', () => {
    expect(firstToActPostflop([0, 1, 2, 3], 0)).toBe(1);
  });

  it('postflop heads-up: the big blind acts first', () => {
    expect(firstToActPostflop([2, 5], 2)).toBe(5);
  });
});
