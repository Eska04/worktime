import { Link } from 'react-router-dom';
import { ArrowUpRight, Play, Plus, Clock3 } from 'lucide-react';
import { defaultPeriod } from '../../../shared/time';
import { useActive, useEntries, useReport, useEmployees } from '../lib/api';
import { Empty, ErrorMessage, Loading, PageTitle } from '../components/ui';
import { Metrics, DailyChart } from './reports';
import { ActiveList } from './timer';
import { EntryTable } from './entries';
export function Dashboard() {
  const report = useReport(defaultPeriod()),
    active = useActive(),
    entries = useEntries({ pageSize: 5 }),
    employees = useEmployees();
  return (
    <>
      <PageTitle
        title="Обзор"
        description="Всё о рабочем времени вашей команды"
        action={
          <Link className="button primary" to="/timer">
            <Play size={17} />
            Запустить таймер
          </Link>
        }
      />
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">РАБОТАЙТЕ ОСОЗНАННО</span>
          <h2>
            Время под контролем.
            <br />
            Команда — в ритме.
          </h2>
          <p>
            Отслеживайте задачи, замечайте прогресс
            <br className="desktop-label" /> и планируйте следующий шаг.
          </p>
          <Link to="/reports">
            Посмотреть отчёты <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="banner-clock" aria-hidden="true">
          <Clock3 size={106} strokeWidth={1} />
          <span className="clock-dot one" />
          <span className="clock-dot two" />
        </div>
      </div>
      <div className="period-label">
        <h2>Последние 7 дней</h2>
        <span>
          {defaultPeriod().startDate.split('-').reverse().join('.')} —{' '}
          {defaultPeriod().endDate.split('-').reverse().join('.')}
        </span>
      </div>
      <ErrorMessage error={report.error || active.error || entries.error || employees.error} />
      {report.isPending ? <Loading /> : !report.error && <Metrics report={report.data} />}
      <div className="overview-grid">
        {report.data && <DailyChart report={report.data} />}
        <section className="card">
          <div className="section-head">
            <h2>Активные таймеры</h2>
            <span className="count">{active.data?.length ?? 0}</span>
          </div>
          {active.isPending ? (
            <Loading />
          ) : active.error ? (
            <ErrorMessage error={active.error} />
          ) : active.data?.length ? (
            <ActiveList entries={active.data} />
          ) : (
            <Empty
              title="Сейчас нет активных сессий"
              description="Начните задачу — и время появится здесь."
              action={
                <Link className="text-link" to="/timer">
                  Запустить таймер →
                </Link>
              }
            />
          )}
        </section>
      </div>
      <section className="card">
        <div className="section-head">
          <h2>Недавние записи</h2>
          <Link className="text-link" to="/entries">
            Все записи <ArrowUpRight size={15} />
          </Link>
        </div>
        {entries.isPending || employees.isPending ? (
          <Loading />
        ) : entries.error || employees.error ? (
          <ErrorMessage error={entries.error || employees.error} />
        ) : !employees.data?.length ? (
          <Empty
            title="Добро пожаловать в WorkTime"
            description="Добавьте первого сотрудника, чтобы начать учёт времени."
            action={
              <Link className="button primary" to="/employees">
                <Plus size={17} />
                Добавить сотрудника
              </Link>
            }
          />
        ) : (
          <EntryTable data={entries.data} page={1} onPage={() => {}} compact />
        )}
      </section>
      <p className="footnote">
        Завершённые сессии включены в статистику. Активные таймеры отображаются отдельно.
      </p>
    </>
  );
}
