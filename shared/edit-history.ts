export type EditHistory<T> = { past: T[]; present: T; future: T[] };
export const initialHistory = <T>(present: T): EditHistory<T> => ({
  past: [],
  present,
  future: [],
});
export function editHistory<T>(state: EditHistory<T>, value: T, coalesce = false): EditHistory<T> {
  if (JSON.stringify(value) === JSON.stringify(state.present)) return state;
  return {
    past: coalesce && state.past.length ? state.past : [...state.past, state.present].slice(-100),
    present: value,
    future: [],
  };
}
export function undoHistory<T>(s: EditHistory<T>): EditHistory<T> {
  return s.past.length
    ? {
        past: s.past.slice(0, -1),
        present: s.past.at(-1)!,
        future: [s.present, ...s.future].slice(0, 100),
      }
    : s;
}
export function redoHistory<T>(s: EditHistory<T>): EditHistory<T> {
  return s.future.length
    ? { past: [...s.past, s.present].slice(-100), present: s.future[0], future: s.future.slice(1) }
    : s;
}
