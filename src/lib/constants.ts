import type { ChipDenomination, GameSettings } from '@/types';

/** Standard casino chip colors, keyed by denomination value. */
export const DEFAULT_DENOMINATIONS: ChipDenomination[] = [
  { value: 5, color: '#e23b3b' },
  { value: 10, color: '#3b7de2' },
  { value: 25, color: '#2fb36b' },
  { value: 50, color: '#e08b2f' },
  { value: 100, color: '#111820' },
  { value: 500, color: '#8b3be2' },
  { value: 1000, color: '#d4af37' },
];

export const DEFAULT_SETTINGS: GameSettings = {
  variant: 'No-Limit Texas Hold’em',
  currency: '₹',
  smallBlind: 10,
  bigBlind: 20,
  ante: 0,
  startingBuyIn: 1000,
  defaultRebuy: 1000,
  minRaiseRule: 'standard',
  remainderRule: 'closest-to-button',
  autoRotateDealer: true,
  chipDenominations: DEFAULT_DENOMINATIONS,
  maxSeats: 9,
};

/** Distinct, high-contrast seat accent colors. */
export const SEAT_COLORS: string[] = [
  '#e2b13b', // gold
  '#3ba7e2', // sky
  '#e2603b', // coral
  '#5ee08b', // mint
  '#b98cff', // lavender
  '#ff8cc4', // pink
  '#7ce0d4', // teal
  '#f2d16b', // sand
  '#8fb4ff', // periwinkle
];

/** A friendly set of default player names to speed up setup. */
export const SAMPLE_NAMES = ['Alex', 'Rahul', 'Sam', 'John', 'Priya', 'Maya', 'Dev', 'Zoe', 'Kiran'];

export const MAX_UNDO = 60;
