import { useRef, useState } from 'react';
import {
  editHistory,
  initialHistory,
  redoHistory,
  undoHistory,
} from '../../../shared/edit-history';
export function useEditHistory<T>(initial: T) {
  const [state, setState] = useState(() => initialHistory(initial));
  const previous = useRef({ key: '', at: 0 });
  function setDraft(value: T, coalesce = true) {
    const s = state;
    const changes = Object.keys(value as object).filter(
      (key) =>
        JSON.stringify((s.present as Record<string, unknown>)[key]) !==
        JSON.stringify((value as Record<string, unknown>)[key]),
    );
    // Group continuous edits only to the same leaf. Switching controls starts a new step.
    function leaf(a: unknown, b: unknown, prefix = ''): string[] {
      if (JSON.stringify(a) === JSON.stringify(b)) return [];
      if (
        a &&
        b &&
        typeof a === 'object' &&
        typeof b === 'object' &&
        !Array.isArray(a) &&
        !Array.isArray(b)
      )
        return Object.keys(b).flatMap((k) =>
          leaf(
            (a as Record<string, unknown>)[k],
            (b as Record<string, unknown>)[k],
            prefix + '.' + k,
          ),
        );
      return [prefix];
    }
    const keys = changes.flatMap((k) =>
      leaf((s.present as Record<string, unknown>)[k], (value as Record<string, unknown>)[k], k),
    );
    const key = keys.length === 1 ? keys[0] : '';
    const now = Date.now();
    const group =
      coalesce && !!key && previous.current.key === key && now - previous.current.at < 650;
    previous.current = { key: coalesce ? key : '', at: now };
    setState(editHistory(s, value, group));
  }
  const move = (direction: 'undo' | 'redo') => {
    previous.current = { key: '', at: 0 };
    setState(direction === 'undo' ? undoHistory<T> : redoHistory<T>);
  };
  const reset = (value: T) => {
    previous.current = { key: '', at: 0 };
    setState(initialHistory(value));
  };
  return {
    draft: state.present,
    setDraft,
    reset,
    undo: () => move('undo'),
    redo: () => move('redo'),
    canUndo: !!state.past.length,
    canRedo: !!state.future.length,
  };
}
