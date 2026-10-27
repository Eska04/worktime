import { useRef } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '../../components/ui';
import type { Entry } from '../../../../shared/types';
import { dateTime, duration } from '../../../../shared/time';
import { Avatar, LiveDuration } from '../../components/ui';

export const hoursMinutes = (seconds: number) => duration(seconds).slice(0, -3);
export const hours = (seconds: number) =>
  `${(seconds / 3600).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} ч`;
export const shortDate = (value: string) => value.split('-').reverse().join('.');
export function MobilePeriod({
  startDate,
  endDate,
  onStart,
  onEnd,
  onApply,
  children,
}: {
  startDate: string;
  endDate: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  onApply: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <div className="mobile-period">
      <span className="mobile-field-label">Период</span>
      <details ref={ref}>
        <summary>
          {startDate || endDate
            ? `${startDate ? shortDate(startDate) : 'Начало'} — ${endDate ? shortDate(endDate) : 'Сегодня'}`
            : 'За всё время'}
          <ChevronDown size={14} />
        </summary>
        <form
          className="mobile-period-panel form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            onApply();
            ref.current!.open = false;
          }}
        >
          <label>
            С даты
            <input type="date" value={startDate} onChange={(e) => onStart(e.target.value)} />
          </label>
          <label>
            По дату
            <input
              type="date"
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => onEnd(e.target.value)}
            />
          </label>
          {children}
          <Button>Применить</Button>
        </form>
      </details>
    </div>
  );
}
export function MobileEntryRow({
  entry,
  onClick,
  compact = false,
}: {
  entry: Entry;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className="mobile-record"
      onClick={onClick}
      aria-label={`Открыть запись ${entry.description}`}
    >
      <Avatar name={entry.fullName ?? ''} initials={1} />
      <span className="mobile-record-copy">
        <strong>{entry.fullName}</strong>
        <span>{entry.description}</span>
        <small>{dateTime(entry.startedAt)}</small>
      </span>
      {!compact && (
        <span className="mobile-record-time">
          {entry.endedAt ? (
            hoursMinutes(entry.durationSeconds ?? 0)
          ) : (
            <LiveDuration startedAt={entry.startedAt} />
          )}
        </span>
      )}
    </button>
  );
}
