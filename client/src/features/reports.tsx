import { useState } from 'react';
import { Clock3, Layers3, Users, TrendingUp, Download } from 'lucide-react';
import type { Report } from '../../../shared/types';
import { defaultPeriod, duration } from '../../../shared/time';
import { useReport, useEmployees, download, params } from '../lib/api';
import { Avatar, Button, Empty, ErrorMessage, Loading, PageTitle } from '../components/ui';

export function Metrics({ report }: { report?: Report }) {
  const items = [
    {
      label: 'Общее время',
      value: duration(report?.totalSeconds ?? 0),
      icon: Clock3,
      color: 'teal',
      note: 'Завершённые сессии',
    },
    {
      label: 'Завершённые сессии',
      value: report?.sessionCount ?? 0,
      icon: Layers3,
      color: 'blue',
      note: 'За выбранный период',
    },
    {
      label: 'Сотрудников с записями',
      value: report?.employeeCount ?? 0,
      icon: Users,
      color: 'purple',
      note: 'Участвовали в работе',
    },
    {
      label: 'В среднем за день',
      value: duration(report?.averagePerActiveDay ?? 0),
      icon: TrendingUp,
      color: 'orange',
      note: 'На день с записями',
    },
  ];
  return (
    <div className="stats-grid">
      {items.map((i) => (
        <section className="stat card" key={i.label}>
          <div className="stat-top">
            <span>{i.label}</span>
            <span className={`stat-icon ${i.color}`}>
              <i.icon size={18} />
            </span>
          </div>
          <strong>{i.value}</strong>
          <small>{i.note}</small>
        </section>
      ))}
    </div>
  );
}
export function DailyChart({ report }: { report?: Report }) {
  const values = report?.daily ?? [],
    max = Math.max(1, ...values.map((d) => d.seconds));
  const width = Math.max(600, values.length * 32),
    height = 190,
    padding = 24;
  return (
    <section className="card chart-card">
      <div className="section-head">
        <div>
          <h2>Время по дням</h2>
          <p className="muted">Часы работы · Душанбе, UTC+5</p>
        </div>
        <span className="legend">
          <i />
          Рабочее время
        </span>
      </div>
      {!report?.totalSeconds ? (
        <Empty
          title={
            report?.sessionCount
              ? 'Длительность сессий — 0 секунд'
              : 'Нет записей за выбранный период'
          }
          description={
            report?.sessionCount
              ? 'Сессии завершены в ту же секунду, когда были запущены.'
              : 'Измените даты или добавьте завершённую сессию.'
          }
        />
      ) : (
        <div className="chart-scroll">
          <svg
            viewBox={`0 0 ${width} ${height + 46}`}
            role="img"
            aria-label="Рабочее время по дням"
            style={{ minWidth: Math.min(width, 800) }}
          >
            {[0, 1, 2, 3].map((n) => (
              <g key={n}>
                <line
                  x1={padding}
                  y1={height - (n * (height - 20)) / 3}
                  x2={width - 8}
                  y2={height - (n * (height - 20)) / 3}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                />
                <text x={padding} y={height - (n * (height - 20)) / 3 - 6} className="chart-label">
                  {((max * n) / 3 / 3600).toFixed(1)} ч
                </text>
              </g>
            ))}
            {values.map((d, i) => {
              const cell = (width - padding) / values.length,
                barWidth = Math.min(44, cell * 0.55),
                h = (d.seconds / max) * (height - 28),
                x = padding + i * cell + cell / 2 - barWidth / 2;
              return (
                <g key={d.date}>
                  <title>
                    {d.date}: {duration(d.seconds)}
                  </title>
                  <rect
                    x={x}
                    y={height - h}
                    width={barWidth}
                    height={h}
                    rx={4}
                    fill="var(--teal)"
                    opacity={i === values.length - 1 ? 1 : 0.65}
                  />
                  {(values.length <= 14 || i % Math.ceil(values.length / 12) === 0) && (
                    <text
                      textAnchor="middle"
                      x={x + barWidth / 2}
                      y={height + 25}
                      className="chart-label"
                    >
                      {d.date.slice(8)}.{d.date.slice(5, 7)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
export function Reports() {
  const [draft, setDraft] = useState({ ...defaultPeriod(), employeeId: '' }),
    [filters, setFilters] = useState(draft),
    [exportError, setExportError] = useState<unknown>(),
    [exporting, setExporting] = useState(false);
  const report = useReport(filters),
    employees = useEmployees(true);
  return (
    <>
      <PageTitle
        title="Отчёты"
        description="Посмотрите, как распределяется рабочее время"
        action={
          <Button
            variant="secondary"
            disabled={exporting || report.isPending || !!report.error}
            onClick={async () => {
              setExportError(undefined);
              setExporting(true);
              try {
                await download(`/exports/entries.csv?${params(filters)}`, 'worktime.csv');
              } catch (e) {
                setExportError(e);
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download size={17} />
            {exporting ? 'Экспортируем…' : 'Экспорт CSV'}
          </Button>
        }
      />
      <form
        className="card filter-bar report-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(draft);
        }}
      >
        <label>
          С даты
          <input
            required
            type="date"
            value={draft.startDate}
            onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
          />
        </label>
        <label>
          По дату
          <input
            required
            type="date"
            min={draft.startDate}
            value={draft.endDate}
            onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
          />
        </label>
        <label>
          Сотрудник
          <select
            value={draft.employeeId}
            onChange={(e) => setDraft({ ...draft, employeeId: e.target.value })}
          >
            <option value="">Вся команда</option>
            {employees.data?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </label>
        <Button>Применить</Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const reset = { ...defaultPeriod(), employeeId: '' };
            setDraft(reset);
            setFilters(reset);
          }}
        >
          Сбросить фильтры
        </Button>
      </form>
      <ErrorMessage error={report.error || exportError || employees.error} />
      {report.isPending ? (
        <Loading />
      ) : (
        !report.error && (
          <>
            <Metrics report={report.data} />
            <DailyChart report={report.data} />
            <section className="card">
              <div className="section-head">
                <h2>По сотрудникам</h2>
                <span className="muted">
                  {filters.startDate} — {filters.endDate}
                </span>
              </div>
              {report.data?.byEmployee.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Сотрудник</th>
                        <th>Сессии</th>
                        <th>Общее время</th>
                        <th>Доля времени</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.data.byEmployee.map((e) => (
                        <tr key={e.employeeId}>
                          <td>
                            <a className="person" href={`/employees/${e.employeeId}`}>
                              <Avatar name={e.fullName} />
                              <strong>{e.fullName}</strong>
                            </a>
                          </td>
                          <td>{e.sessionCount}</td>
                          <td className="digits">{duration(e.seconds)}</td>
                          <td>
                            <div className="share">
                              <span
                                style={{
                                  width: `${report.data!.totalSeconds ? (e.seconds / report.data!.totalSeconds) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <small>
                              {report.data!.totalSeconds
                                ? Math.round((e.seconds / report.data!.totalSeconds) * 100)
                                : 0}
                              %
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty title="Нет записей за выбранный период" />
              )}
            </section>
            <p className="footnote">
              В итогах учитываются только завершённые сессии. Интервалы на границах периода и суток
              распределяются по фактическому пересечению.
            </p>
          </>
        )
      )}
    </>
  );
}
