import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  // Return false to reject the edit (the field reverts).
  onCommit: (v: string) => boolean | void;
  // Move to the previous/next row (grid cells).
  onNav?: (dir: 1 | -1) => void;
  fk?: string;
};

// Text field that edits locally and commits on Enter or blur, like a spreadsheet cell.
export default function Field({ value, onCommit, onNav, fk, ...rest }: Props) {
  const [v, setV] = useState(value);
  const focused = useRef(false);
  const cancelled = useRef(false);
  const last = useRef<string | null>(null);
  useEffect(() => { last.current = null; if (!focused.current) setV(value); }, [value]);

  const commit = () => {
    if (cancelled.current) { cancelled.current = false; return; }
    if (v === value || v === last.current) return;
    last.current = v;
    if (onCommit(v) === false) { last.current = null; setV(value); }
  };

  return (
    <input
      {...rest}
      data-fk={fk}
      value={v}
      onFocus={e => { focused.current = true; rest.onFocus?.(e); }}
      onBlur={() => { focused.current = false; commit(); }}
      onChange={e => setV(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' || ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && onNav)) {
          e.preventDefault();
          commit();
          if (onNav) onNav(e.key === 'ArrowUp' ? -1 : 1);
          else (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setV(value);
          cancelled.current = true;
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
