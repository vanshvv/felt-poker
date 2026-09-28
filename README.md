# ♠ Felt — Offline Poker Table & Chip Simulator

A polished, local-first web app that replaces physical poker chips for a home
game played with a **real deck of cards**. Felt handles every bit of the money:
buy-ins, blinds, betting, calls/raises/folds/all-ins, **main & side pots**,
split-pot settlement, rebuys, cash-outs, session accounting and a full ledger.

The app never touches cards — you deal those yourself. It is the
**chips + dealer state + betting tracker + pot calculator + bankroll ledger +
session manager**.

---

## Quick start

```bash
npm install
npm run dev        # open the printed localhost URL
```

Other scripts:

```bash
npm run build      # type-check + production build (static, offline-ready PWA)
npm run preview    # preview the production build
npm test           # run the poker-engine unit tests (Vitest)
npm run typecheck  # type-check only
```

No account, no server, no internet required after the first load. State is saved
to `localStorage` and the build ships as an installable PWA, so you can drop it
on a laptop/tablet at the table and use it all night — including offline.

---

## Why Vite + React (not Next.js)

The brief asked for a **local-first, fully offline, no-backend** app and to
explain any stack change. Next.js exists primarily to provide server
infrastructure this app must *not* have. Vite gives a simpler build, a trivial
offline/PWA setup and a static bundle that opens on any device. Everything else
matches the requested stack:

- **React 18 + TypeScript** — UI
- **Zustand** — lightweight state, with `persist` → `localStorage`
- **Tailwind CSS v4** — styling
- **Vitest** — engine unit tests
- **vite-plugin-pwa** — offline / installable

---

## Architecture

The poker engine is a set of **pure functions with no UI dependency**, fully
unit-tested. The store and React components sit on top.

```
src/
  types/                     # domain model (Player, HandState, Pot, Ledger, …)
  lib/
    constants.ts             # default settings, chip denominations, seat colors
    poker/                   # THE ENGINE — pure, framework-free, tested
      betting/
        actions.ts           # legalActions, validateAction, applyAction (+ re-open rule)
        round.ts             # turn order, round completion, street advance, refunds
      pots/sidePots.ts       # contribution-layer main/side-pot builder
      settlement/distribute.ts # pot distribution + odd-chip rule
      blinds/rotation.ts     # button / SB / BB / heads-up logic
      hand.ts                # startHand, finalizeHand, resolveUncontested
      accounting.ts          # invariants: table balance & net-sum-zero
      format.ts              # money formatting + chip breakdown
  store/useGameStore.ts      # Zustand store: wires engine, ledger, undo, persistence
  components/
    setup/                   # session setup screen
    table/                   # PokerTable, seats, pot, action bar, showdown
    player/                  # rebuy / cash-out / edit modal
    session/                 # dashboard, ledger, hand history (tabbed drawer)
    settings/                # stakes, denominations, export/import, reset
    common/                  # chips, drawer, modal, formatting hook
```

### The side-pot engine (the important part)

`buildPots()` uses a **contribution-layer** algorithm, not naive division.
Every player's *total hand contribution* and folded flag go in; out come
main + side pots, each with its exact amount and the set of players eligible to
win it. Folded players' chips stay in the pot but they are never eligible.
Adjacent layers with identical eligibility are merged.

Worked example — A all-in 100, B all-in 300, C 500, D 500 (all called):

| Layer | Each puts in | Pot | Eligible |
|------|------|------|------|
| 100  | 100 × 4 | **400** | A B C D (Main) |
| 300  | 200 × 3 | **600** | B C D (Side 1) |
| 500  | 200 × 2 | **400** | C D (Side 2) |

Total 1400 = sum of contributions. Uncalled bets are **refunded** as each
betting round closes, so a pot layer can never end up with zero eligible players.

### Odd-chip rule (documented & configurable)

When a pot doesn't divide evenly among split winners, the leftover chips are
awarded one at a time to winners in **clockwise order from the dealer button**
(the winner closest to the left of the button gets the first odd chip) — the
standard high-hand casino rule. See `settlement/distribute.ts`.

### Correct No-Limit Hold'em betting rules

- Minimum-raise enforcement (raise ≥ previous raise increment; min opening bet = BB).
- All-in for less than a full raise is allowed but **does not re-open the
  betting** for players who have already acted (the incomplete-raise rule).
- Big-blind option pre-flop; heads-up button posts the small blind and acts
  first pre-flop.
- Uncalled bets are returned before the pot is contested.

### Accounting invariants

At all times **table money + cash-outs = total buy-ins**, and the **sum of every
player's net result = 0**. The Session dashboard shows a live ✓/⚠ integrity
check; any mismatch is surfaced rather than hidden.

---

## Using it at the table

1. **Set up** — stakes, buy-in, then add players.
2. **Deal Hand** — Felt posts blinds/antes and marks Dealer / SB / BB.
3. Play the physical cards; the operator taps each betting action
   (Fold / Check / Call / Bet / Raise / All-In).
4. **Next Street** to move Pre-Flop → Flop → Turn → River (place the community
   cards yourself). All-in? **Run it out** jumps to showdown.
5. **Showdown** — reveal cards, pick the winner(s) of each pot; Felt distributes.
6. **Next Hand** — the button rotates, empty/broke seats are skipped.

Tap any seat to **rebuy, cash out, edit, sit out or make dealer**. Mistake?
**Undo** reverts the last action exactly; **Undo hand** rolls back the whole
hand. Refreshing the browser never loses the session.

Keyboard: `u` = undo, `Enter` = deal / next street / next hand.

---

## Testing

`npm test` runs the engine suite (40 tests) covering:

- Side pots: two-/three-way all-ins, multiple side pots, folded-player
  contributions, unequal stacks, chip conservation, layer merging.
- Settlement: single & multi-winner splits, odd-chip distribution, eligibility.
- Betting: call/check/bet/raise/fold/all-in, min-raise validation, out-of-turn
  and over-stack rejection, the incomplete-raise re-open rule.
- Blinds: button rotation with gaps, SB/BB assignment, heads-up.
- Accounting: chip conservation through a full hand to showdown.

---

## Extending later (V2 ideas, intentionally out of scope for V1)

The engine is UI-agnostic and variant-friendly, so future work could add other
poker variants or a multi-device mode (laptop = table display, phones = player
controls) without touching the core. V1 works perfectly on a single device.
