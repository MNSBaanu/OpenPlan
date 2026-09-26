// Undo and redo each keep up to 100 snapshots and about 20 MB (10M UTF-16 characters), always including the latest.
const HISTORY_MAX = 100, HISTORY_CHARS = 10_000_000;
export function capHistory(list: string[]) {
  let i = list.length - 1, total = list[i]?.length ?? 0;
  while (i > 0 && list.length - i < HISTORY_MAX && total + list[i - 1].length <= HISTORY_CHARS) total += list[--i].length;
  return i > 0 ? list.slice(i) : list;
}
