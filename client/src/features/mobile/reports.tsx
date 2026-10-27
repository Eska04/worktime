import { useState } from 'react';
import { Download, ListChecks, Users } from 'lucide-react';
import { defaultPeriod, duration } from '../../../../shared/time';
import { download, params, useEmployees, useReport } from '../../lib/api';
import { Button, ErrorMessage, Loading } from '../../components/ui';
import { hours, MobilePeriod } from './common';

export function MobileReports() {
  const [draft, setDraft] = useState({ ...defaultPeriod(), employeeId: '' }),
    [filters, setFilters] = useState(draft),
    [showEmployee, setShowEmployee] = useState(false);
  const [exporting, setExporting] = useState(false),
    [error, setError] = useState<unknown>();
  const query = useReport(filters),
    employees = useEmployees(true),
    report = query.data;
  const reset = () => {
    const next = { ...defaultPeriod(), employeeId: '' };
    setDraft(next);
    setFilters(next);
    setShowEmployee(false);
  };
  return (
    <div className="mobile-screen mobile-reports">
      {(showEmployee || !!filters.employeeId) && (
        <label>
          Сотрудник
          <select
            value={draft.employeeId}
            onChange={(e) => {
              const next = { ...draft, employeeId: e.target.value };
              setDraft(next);
              setFilters(next);
            }}
          >
            <option value="">Вся команда</option>
            {employees.data?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="mobile-report-period">
        <MobilePeriod
          startDate={draft.startDate}
          endDate={draft.endDate}
          onStart={(v) => setDraft({ ...draft, startDate: v })}
          onEnd={(v) => setDraft({ ...draft, endDate: v })}
          onApply={() => setFilters(draft)}
        />
        <Button
          variant="ghost"
          className="mobile-employee-filter"
          aria-label="Фильтр по сотруднику"
          onClick={() => setShowEmployee(!showEmployee)}
        >
          <Users size={14} />
        </Button>
      </div>
      <ErrorMessage error={query.error || employees.error || error} />
      {query.isPending ? (
        <Loading />
      ) : (
        !query.error &&
        report && (
          <>
            {report.sessionCount > 0 ? (
              <>
                <div className="mobile-metrics mobile-report-metrics">
                  <section className="mobile-metric stat">
                    <span className="mobile-metric-label teal">Всего</span>
                    <strong>{hours(report.totalSeconds)}</strong>
                    <small>За период</small>
                  </section>
                  <section className="mobile-metric stat">
                    <span className="mobile-metric-label blue">Сессии</span>
                    <strong>{report.sessionCount}</strong>
                    <small>Записей</small>
                  </section>
                </div>
                <section className="mobile-panel mobile-team-chart">
                  <h2>Рабочие часы по команде</h2>
                  <div role="img" aria-label="Рабочие часы по сотрудникам">
                    {report.byEmployee.map((e) => (
                      <div
                        className="mobile-bar-row"
                        key={e.employeeId}
                        title={`${e.fullName}: ${duration(e.seconds)}`}
                      >
                        <span>{e.fullName.split(' ')[0]}</span>
                        <div className="mobile-bar-track">
                          <div
                            style={{
                              width: `${(e.seconds / Math.max(1, ...report.byEmployee.map((p) => p.seconds))) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="sr-only">{duration(e.seconds)}</span>
                      </div>
                    ))}
                  </div>
                </section>
                <Button
                  variant="secondary"
                  className="mobile-csv"
                  disabled={exporting}
                  onClick={async () => {
                    setError(undefined);
                    setExporting(true);
                    try {
                      await download(`/exports/entries.csv?${params(filters)}`, 'worktime.csv');
                    } catch (e) {
                      setError(e);
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  <Download size={14} />
                  {exporting ? 'Экспортируем…' : 'Экспорт CSV'}
                </Button>
              </>
            ) : (
              <>
                <section className="mobile-panel mobile-empty-report">
                  <span className="mobile-empty-report-icon">
                    <ListChecks size={28} />
                  </span>
                  <h2>Нет записей</h2>
                  <p>Попробуйте изменить период.</p>
                  <span className="mobile-empty-total">00:00:00</span>
                </section>
                <Button variant="secondary" onClick={reset}>
                  Сбросить фильтры
                </Button>
              </>
            )}
          </>
        )
      )}
    </div>
  );
}
