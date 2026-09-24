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

type DateProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onCommit: (v: string) => void;
  fk?: string;
};

// Date input that commits only complete dates (year 1900 or later), so typing a year digit by digit
// does not save dates like 0002-01-05. Incomplete input reverts on blur.
export function DateField({ value, onCommit, fk, ...rest }: DateProps) {
  const [v, setV] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setV(value); }, [value]);
  const ok = (x: string) => x === '' || (/^\d{4}-\d{2}-\d{2}$/.test(x) && +x.slice(0, 4) >= 1900);
  return (
    <input
      {...rest}
      type="date"
      data-fk={fk}
      value={v}
      onFocus={e => { focused.current = true; rest.onFocus?.(e); }}
      onChange={e => {
        const x = e.target.value;
        setV(x);
        if (ok(x) && x !== value) onCommit(x);
      }}
      onBlur={() => { focused.current = false; if (!ok(v)) setV(value); }}
    />
  );
}
