import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { useEmployees, useReport } from '../../lib/api';
import { defaultPeriod } from '../../../../shared/time';
import { Avatar, Empty, ErrorMessage, Loading } from '../../components/ui';
import { hoursMinutes } from './common';

export function MobileEmployees() {
  const [search, setSearch] = useState(''),
    [archived, setArchived] = useState(false);
  const query = useEmployees(archived, search),
    report = useReport(defaultPeriod());
  return (
    <div className="mobile-screen mobile-team">
      <label className="mobile-search-label">
        Найти сотрудника
        <div className="mobile-search-input">
          <input
            aria-label="Поиск сотрудников"
            placeholder="Введите имя"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Search size={14} />
        </div>
      </label>
      <Link className="button primary mobile-add-person" to="/employees/new">
        <Plus size={14} />
        Добавить сотрудника
      </Link>
      <ErrorMessage error={query.error || report.error} />
      {query.isPending ? (
        <Loading />
      ) : query.data?.length ? (
        <>
          <p className="mobile-list-count">{query.data.length} сотрудников</p>
          <div className="mobile-record-list">
            {query.data.map((e) => (
              <Link
                className="mobile-record mobile-person"
                key={e.id}
                to={`/employees/${e.id}`}
                aria-label={e.fullName}
              >
                <Avatar name={e.fullName} initials={1} />
                <span className="mobile-record-copy">
                  <strong>{e.fullName}</strong>
                  <span>{e.position || 'Должность не указана'}</span>
                  <small>
                    {e.archivedAt
                      ? 'В архиве'
                      : report.data
                        ? `Неделя: ${hoursMinutes(report.data.byEmployee.find((p) => p.employeeId === e.id)?.seconds ?? 0)}`
                        : 'Неделя: …'}
                  </small>
                </span>
                <ChevronRight size={15} />
              </Link>
            ))}
          </div>
        </>
      ) : (
        !query.error && (
          <Empty
            title={search ? 'Никого не нашли' : 'Пока нет сотрудников'}
            description={
              search ? 'Попробуйте изменить запрос.' : 'Добавьте первого участника команды.'
            }
          />
        )
      )}
      <details className="mobile-extra-options">
        <summary>Фильтры списка</summary>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Показывать архив
        </label>
      </details>
    </div>
  );
}
