import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import type { Entry, EntryPage } from '../../../shared/types';
import { api, useAction, useEmployees, useEntries } from '../lib/api';
import {
  Avatar,
  Button,
  Confirm,
  Empty,
  ErrorMessage,
  LiveDuration,
  Loading,
  Modal,
  PageTitle,
  useToast,
} from '../components/ui';
import { dateTime, duration, inputTime, inputToISO } from '../../../shared/time';
import { StopTimer } from './timer';

export function EntryForm({ entry, onClose }: { entry?: Entry; onClose: () => void }) {
  const employees = useEmployees(true),
    toast = useToast();
  const [employeeId, setEmployeeId] = useState(entry?.employeeId ?? '');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [startedAt, setStart] = useState(() =>
    inputTime(entry?.startedAt ?? new Date(Date.now() - 3600000).toISOString()),
  );
  const [endedAt, setEnd] = useState(() => inputTime(entry?.endedAt ?? new Date().toISOString()));
  const mutation = useAction(
    (values: { employeeId: string; description: string; startedAt: string; endedAt: string }) =>
      api<Entry>(entry ? `/entries/${entry.id}` : '/entries', entry ? 'PATCH' : 'POST', values),
  );
  return (
    <Modal title={entry ? 'Редактировать запись' : 'Новая запись времени'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(
            {
              employeeId,
              description: description.trim(),
              startedAt: inputToISO(startedAt),
              endedAt: inputToISO(endedAt),
            },
            {
              onSuccess: () => {
                toast(entry ? 'Запись обновлена' : 'Запись добавлена');
                onClose();
              },
            },
          );
        }}
      >
        <div className="modal-body form-stack">
          <p className="muted">Время указывается в часовом поясе Душанбе (UTC+5).</p>
          <ErrorMessage error={employees.error} />
          <label>
            Сотрудник
            <select required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Выберите сотрудника</option>
              {employees.data
                ?.filter((e) => !e.archivedAt || e.id === entry?.employeeId)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName}
                    {e.archivedAt ? ' (в архиве)' : ''}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Описание задачи
            <textarea
              required
              maxLength={160}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </label>
          <div className="form-grid">
            <label>
              Начало
              <input
                required
                type="datetime-local"
                value={startedAt}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Окончание
              <input
                required
                type="datetime-local"
                value={endedAt}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <ErrorMessage error={mutation.error} />
        </div>
        <footer className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={mutation.isPending || employees.isPending}>
            {mutation.isPending ? 'Сохраняем…' : 'Сохранить запись'}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
export function EntryTable({
  data,
  page,
  onPage,
  compact = false,
}: {
  data?: EntryPage;
  page: number;
  onPage: (p: number) => void;
  compact?: boolean;
}) {
  const [edit, setEdit] = useState<Entry>(),
    [remove, setRemove] = useState<Entry>(),
    [details, setDetails] = useState<Entry>(),
    [stop, setStop] = useState<Entry>();
  const toast = useToast();
  const mutation = useAction(() => api(`/entries/${remove!.id}`, 'DELETE', {}));
  if (!data?.items.length)
    return (
      <Empty
        title="Нет записей за выбранный период"
        description="Запустите таймер или добавьте завершённую сессию вручную."
        action={
          page > 1 ? (
            <Button variant="secondary" onClick={() => onPage(page - 1)}>
              Предыдущая страница
            </Button>
          ) : undefined
        }
      />
    );
  return (
    <>
      <div className="table-scroll">
        <table className="entries-table">
          <thead>
            <tr>
              <th>Сотрудник / задача</th>
              <th>Дата и время</th>
              <th>Длительность</th>
              <th>Статус</th>
              {!compact && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {data.items.map((e) => (
              <tr key={e.id}>
                <td>
                  <div className="person">
                    <Avatar name={e.fullName ?? ''} />
                    <div className="task-cell">
                      <Link to={`/employees/${e.employeeId}`}>
                        <strong>{e.fullName}</strong>
                      </Link>
                      <p className="muted">{e.description}</p>
                    </div>
                  </div>
                </td>
                <td className="date-cell">
                  {dateTime(e.startedAt)}
                  <small>{e.endedAt ? `до ${dateTime(e.endedAt)}` : 'Сессия продолжается'}</small>
                </td>
                <td className="digits">
                  {e.endedAt ? (
                    duration(e.durationSeconds ?? 0)
                  ) : (
                    <LiveDuration startedAt={e.startedAt} />
                  )}
                </td>
                <td>
                  <span className={`badge ${e.endedAt ? 'neutral' : 'success'}`}>
                    {e.endedAt ? (
                      'Завершена'
                    ) : (
                      <>
                        <i className="live-dot" />В работе
                      </>
                    )}
                  </span>
                </td>
                {!compact && (
                  <td>
                    <div className="row-actions">
                      <Button
                        variant="ghost"
                        aria-label={`Открыть запись ${e.description}`}
                        onClick={() => setDetails(e)}
                      >
                        <Eye size={16} />
                      </Button>
                      {e.endedAt ? (
                        <>
                          <Button
                            variant="ghost"
                            aria-label={`Редактировать запись ${e.description}`}
                            onClick={() => setEdit(e)}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            className="danger-text"
                            aria-label={`Удалить запись ${e.description}`}
                            onClick={() => setRemove(e)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </>
                      ) : (
                        <Button variant="secondary" onClick={() => setStop(e)}>
                          Завершить
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!compact && (
        <div className="table-footer">
          <span>
            {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} из{' '}
            {data.total} записей
          </span>
          <div className="pagination">
            <Button
              variant="secondary"
              aria-label="Предыдущая страница"
              disabled={page === 1}
              onClick={() => onPage(page - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <span>
              {page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}
            </span>
            <Button
              variant="secondary"
              aria-label="Следующая страница"
              disabled={page * data.pageSize >= data.total}
              onClick={() => onPage(page + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
      {edit && <EntryForm entry={edit} onClose={() => setEdit(undefined)} />}
      {remove && (
        <Confirm
          title="Удалить запись?"
          onClose={() => setRemove(undefined)}
          onConfirm={() =>
            mutation.mutate(undefined, {
              onSuccess: () => {
                toast('Запись удалена');
                setRemove(undefined);
              },
            })
          }
          error={mutation.error}
          pending={mutation.isPending}
          label="Удалить запись"
          danger
        >
          <p>Запись «{remove.description}» будет удалена. Это действие нельзя отменить.</p>
        </Confirm>
      )}
      {stop && <StopTimer entry={stop} onClose={() => setStop(undefined)} />}
      {details && (
        <Modal title="Подробности записи" onClose={() => setDetails(undefined)}>
          <div className="modal-body details">
            <p>
              <span>Сотрудник</span>
              <strong>{details.fullName}</strong>
            </p>
            <p>
              <span>Задача</span>
              {details.description}
            </p>
            <p>
              <span>Начало · Душанбе</span>
              {dateTime(details.startedAt)}
            </p>
            <p>
              <span>Окончание · Душанбе</span>
              {details.endedAt ? dateTime(details.endedAt) : 'В работе'}
            </p>
            <p>
              <span>Длительность</span>
              {details.endedAt ? (
                duration(details.durationSeconds ?? 0)
              ) : (
                <LiveDuration startedAt={details.startedAt} />
              )}
            </p>
          </div>
          <footer className="modal-actions">
            <Button variant="secondary" onClick={() => setDetails(undefined)}>
              <X size={16} />
              Закрыть
            </Button>
          </footer>
        </Modal>
      )}
    </>
  );
}
const emptyFilters = { employeeId: '', startDate: '', endDate: '', status: 'all' };
export function Entries() {
  const [draft, setDraft] = useState(emptyFilters),
    [filters, setFilters] = useState(emptyFilters),
    [page, setPage] = useState(1),
    [adding, setAdding] = useState(false);
  const employees = useEmployees(true),
    entries = useEntries({ ...filters, page });
  return (
    <>
      <PageTitle
        title="Записи времени"
        description="Вся история работы команды в одном месте"
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={18} />
            Новая запись
          </Button>
        }
      />
      <section className="card">
        <form
          className="filter-bar"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters(draft);
            setPage(1);
          }}
        >
          <label>
            Сотрудник
            <select
              value={draft.employeeId}
              onChange={(e) => setDraft({ ...draft, employeeId: e.target.value })}
            >
              <option value="">Все сотрудники</option>
              {employees.data?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                  {e.archivedAt ? ' (архив)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            С даты
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            />
          </label>
          <label>
            По дату
            <input
              type="date"
              min={draft.startDate || undefined}
              value={draft.endDate}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            />
          </label>
          <label>
            Статус
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            >
              <option value="all">Все записи</option>
              <option value="active">В работе</option>
              <option value="completed">Завершённые</option>
            </select>
          </label>
          <Button type="submit" variant="secondary">
            Применить
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(emptyFilters);
              setFilters(emptyFilters);
              setPage(1);
            }}
          >
            Сбросить
          </Button>
        </form>
        <ErrorMessage error={entries.error || employees.error} />
        {entries.isPending ? (
          <Loading />
        ) : (
          !entries.error && <EntryTable data={entries.data} page={page} onPage={setPage} />
        )}
      </section>
      {adding && <EntryForm onClose={() => setAdding(false)} />}
    </>
  );
}
