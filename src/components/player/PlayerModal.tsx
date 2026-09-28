import { useState } from 'react';
import { useGameStore, selectPhase } from '@/store/useGameStore';
import { playerNet } from '@/lib/poker';
import { useFmt } from '@/components/common/useFmt';
import { Modal, Stat } from '@/components/common/ui';
import { SEAT_COLORS } from '@/lib/constants';

export function PlayerModal({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const player = useGameStore((s) => s.players.find((p) => p.id === playerId));
  const state = useGameStore((s) => s);
  const phase = useGameStore(selectPhase);
  const defaultRebuy = useGameStore((s) => s.settings.defaultRebuy);
  const rebuy = useGameStore((s) => s.rebuy);
  const cashOut = useGameStore((s) => s.cashOut);
  const editPlayer = useGameStore((s) => s.editPlayer);
  const setSittingOut = useGameStore((s) => s.setSittingOut);
  const setButton = useGameStore((s) => s.setButton);
  const removePlayer = useGameStore((s) => s.removePlayer);
  const { fmt, signed } = useFmt();

  const [rebuyAmt, setRebuyAmt] = useState(defaultRebuy);
  const [name, setName] = useState(player?.name ?? '');
  const [confirmRemove, setConfirmRemove] = useState(false);

  if (!player) return null;
  const net = playerNet(state, player);
  const betweenHands = phase === 'idle' || phase === 'setup' || phase === 'complete';
  const foldedInHand =
    state.hand && state.hand.players.find((p) => p.id === playerId)?.status === 'folded';
  const canMoney = betweenHands || foldedInHand;

  return (
    <Modal open title={player.name} onClose={onClose} maxWidth={480}>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Stack" value={<span className="tnum">{fmt(player.stack)}</span>} />
        <Stat label="Invested" value={<span className="tnum">{fmt(player.buyIns)}</span>} />
        <Stat
          label="Net"
          value={<span className="tnum">{signed(net)}</span>}
          tone={net >= 0 ? 'win' : 'loss'}
        />
      </div>

      {player.cashedOut != null && (
        <div className="glass rounded-xl px-3 py-2 mb-4 text-sm">
          Cashed out for <span className="tnum text-[var(--gold-soft)]">{fmt(player.cashedOut)}</span>.
          Rebuy below to bring them back.
        </div>
      )}

      {/* Rebuy */}
      <div className="mb-3">
        <div className="text-[0.66rem] uppercase tracking-wider text-[var(--muted)] mb-1.5">
          {player.cashedOut != null ? 'Re-enter' : 'Rebuy / add-on'}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            className="chip-input tnum flex-1"
            value={rebuyAmt}
            onChange={(e) => setRebuyAmt(parseInt(e.target.value, 10) || 0)}
          />
          <button
            className="btn btn-success"
            disabled={!canMoney || rebuyAmt <= 0}
            onClick={() => rebuy(playerId, rebuyAmt)}
          >
            + Add {fmt(rebuyAmt)}
          </button>
        </div>
        {!canMoney && (
          <div className="text-[0.66rem] text-[var(--muted-2)] mt-1">
            Available between hands, or after this player folds.
          </div>
        )}
      </div>

      {/* Cash out */}
      {player.cashedOut == null && (
        <button
          className="btn btn-ghost w-full mb-3"
          disabled={!canMoney}
          onClick={() => {
            cashOut(playerId);
            onClose();
          }}
        >
          Cash out for {fmt(player.stack)}
        </button>
      )}

      {/* Edit name + color */}
      <div className="glass rounded-xl p-3 mb-3">
        <div className="text-[0.66rem] uppercase tracking-wider text-[var(--muted)] mb-2">Edit</div>
        <div className="flex gap-2 mb-2">
          <input
            className="chip-input flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && editPlayer(playerId, { name: name.trim() })}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SEAT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => editPlayer(playerId, { color: c })}
              className="w-6 h-6 rounded-full"
              style={{
                background: c,
                outline: player.color === c ? '2px solid var(--cream)' : 'none',
                outlineOffset: 2,
              }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </div>

      {/* Utility actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          className="btn btn-ghost"
          disabled={!betweenHands}
          onClick={() => setButton(player.seat)}
        >
          Make dealer
        </button>
        <button
          className="btn btn-ghost"
          disabled={!betweenHands}
          onClick={() => setSittingOut(playerId, !player.sittingOut)}
        >
          {player.sittingOut ? 'Sit in' : 'Sit out'}
        </button>
      </div>

      <div className="mt-3">
        {confirmRemove ? (
          <div className="flex gap-2">
            <button
              className="btn btn-danger flex-1"
              onClick={() => {
                removePlayer(playerId);
                onClose();
              }}
            >
              Confirm remove
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmRemove(false)}>
              Keep
            </button>
          </div>
        ) : (
          <button
            className="btn btn-ghost w-full text-[var(--loss)]"
            disabled={!betweenHands}
            onClick={() => setConfirmRemove(true)}
          >
            Remove player
          </button>
        )}
      </div>
    </Modal>
  );
}
