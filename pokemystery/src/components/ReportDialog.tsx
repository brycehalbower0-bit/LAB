import { useRef, useState } from 'react';
import { api } from '../lib/api';

const CATEGORIES = [
  { value: 'accidental-answer', label: 'I answered something by accident' },
  { value: 'unclear-question', label: 'A question was unclear' },
  { value: 'inaccurate-data', label: 'The game data seems wrong' },
  { value: 'missing-pokemon', label: 'A Pokémon is missing' },
  { value: 'other', label: 'Something else' },
] as const;

export function ReportDialog({
  sessionId,
  pokemonId,
}: {
  sessionId: string | undefined;
  pokemonId: number | undefined;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState<string>('inaccurate-data');
  const [detail, setDetail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const submit = async () => {
    setStatus('sending');
    try {
      await api.report({
        ...(sessionId !== undefined ? { sessionId } : {}),
        ...(pokemonId !== undefined ? { pokemonId } : {}),
        category,
        ...(detail.trim() !== '' ? { detail: detail.trim() } : {}),
      });
      setStatus('sent');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => dialogRef.current?.showModal()}>
        Report a problem
      </button>
      <dialog ref={dialogRef} className="report-dialog" aria-label="Report a problem">
        {status === 'sent' ? (
          <>
            <p>Thanks — your report was recorded for review.</p>
            <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
              Close
            </button>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <h2>Report a problem</h2>
            <p>
              <label>
                What went wrong?
                <br />
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </p>
            <p>
              <label>
                Details (optional)
                <br />
                <input
                  type="text"
                  value={detail}
                  maxLength={500}
                  onChange={(event) => setDetail(event.target.value)}
                  style={{ width: '100%', minHeight: 44 }}
                />
              </label>
            </p>
            {status === 'failed' ? <p className="error-text">Could not send — try again.</p> : null}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
                Send report
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
