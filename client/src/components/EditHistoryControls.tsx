import { Button } from '../design-system';
import { Undo2, Redo2 } from 'lucide-react';
export function EditHistoryControls({
  history,
  busy = false,
}: {
  history: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean };
  busy?: boolean;
}) {
  return (
    <div className="row" role="group" aria-label="Histórico de edição">
      <Button variant="secondary" disabled={busy || !history.canUndo} onClick={history.undo}>
        <Undo2 size={16} /> Desfazer
      </Button>
      <Button variant="secondary" disabled={busy || !history.canRedo} onClick={history.redo}>
        <Redo2 size={16} /> Refazer
      </Button>
    </div>
  );
}
