import { Link, useNavigate } from 'react-router-dom';
import { Play, Plus } from 'lucide-react';
import { DateTime } from 'luxon';
import { defaultPeriod, today, TIME_ZONE } from '../../../../shared/time';
import { useActive, useEmployees, useEntries, useReport } from '../../lib/api';
import { Empty, ErrorMessage, Loading } from '../../components/ui';
import { hours, hoursMinutes, MobileEntryRow } from './common';

export function MobileDashboard() {
  const navigate = useNavigate(),
    date = today();
  const daily = useReport({ startDate: date, endDate: date }),
    week = useReport(defaultPeriod()),
    active = useActive(),
    employees = useEmployees(),
    entries = useEntries({ pageSize: 3 });
  const metrics = [
    {
      label: 'Сегодня',
      value: hoursMinutes(daily.data?.totalSeconds ?? 0),
      note: 'По команде',
      color: 'teal',
    },
    { label: 'Активных', value: active.data?.length ?? 0, note: 'Таймеров', color: 'orange' },
    { label: 'Сотрудников', value: employees.data?.length ?? 0, note: 'В команде', color: 'blue' },
    {
      label: 'Неделя',
      value: hours(week.data?.totalSeconds ?? 0),
      note: 'Всё время',
      color: 'teal',
    },
  ];
  const error = daily.error || week.error || active.error || employees.error;
  return (
    <div className="mobile-screen mobile-overview">
      <p className="mobile-today">
        Сегодня, {DateTime.fromISO(date, { zone: TIME_ZONE }).setLocale('ru').toFormat('d MMMM')}
      </p>
      <ErrorMessage error={error} />
      {daily.isPending || week.isPending || active.isPending || employees.isPending ? (
        <Loading />
      ) : (
        !error && (
          <div className="mobile-metrics">
            {metrics.map((m) => (
              <section className="mobile-metric stat" key={m.label}>
                <span className={`mobile-metric-label ${m.color}`}>{m.label}</span>
                <strong>{m.value}</strong>
                <small>{m.note}</small>
              </section>
            ))}
          </div>
        )
      )}
      <section className="mobile-panel mobile-new-session">
        <h2>Новая рабочая сессия</h2>
        <p>Добавьте задачу и начните отсчёт времени.</p>
        <Link className="button primary" to="/timer/new">
          <Play size={14} />
          Запустить таймер
        </Link>
      </section>
      <section className="mobile-recent">
        <h2>Последние записи</h2>
        <ErrorMessage error={entries.error} />
        {entries.isPending ? (
          <Loading />
        ) : entries.data?.items.length ? (
          <div className="mobile-record-list">
            {entries.data.items.map((entry) => (
              <MobileEntryRow
                key={entry.id}
                entry={entry}
                compact
                onClick={() => navigate(`/entries?entryId=${entry.id}`)}
              />
            ))}
          </div>
        ) : (
          !entries.error && (
            <Empty
              title={employees.data?.length ? 'Пока нет записей' : 'Добро пожаловать в WorkTime'}
              description="Добавьте сотрудника и начните первую сессию."
              action={
                <Link
                  className="button secondary"
                  to={employees.data?.length ? '/timer/new' : '/employees/new'}
                >
                  <Plus size={14} />
                  {employees.data?.length ? 'Запустить таймер' : 'Добавить сотрудника'}
                </Link>
              }
            />
          )
        )}
      </section>
    </div>
  );
}
