import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Pencil, Archive, RotateCcw, ArrowLeft, Timer } from 'lucide-react';
import type { Employee } from '../../../shared/types';
import { api, ApiError, useAction, useEmployees, useEntries, useReport } from '../lib/api';
import {
  Avatar,
  Button,
  Confirm,
  Empty,
  ErrorMessage,
  Loading,
  Modal,
  PageTitle,
  useToast,
} from '../components/ui';
import { defaultPeriod, duration, dateTime } from '../../../shared/time';
import { EntryTable } from './entries';

export function EmployeeForm({
  employee,
  onClose,
  page = false,
}: {
  employee?: Employee;
  onClose: () => void;
  page?: boolean;
}) {
  const [fullName, setName] = useState(employee?.fullName ?? ''),
    [position, setPosition] = useState(employee?.position ?? '');
  const toast = useToast();
  const mutation = useAction((values: { fullName: string; position: string }) =>
    api<Employee>(
      employee ? `/employees/${employee.id}` : '/employees',
      employee ? 'PATCH' : 'POST',
      values,
    ),
  );
  const nameError =
    mutation.error instanceof ApiError
      ? mutation.error.details?.find((d) => d.path[0] === 'fullName')?.message
      : undefined;
  const form = (
    <form
      className="employee-editor"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(
          { fullName: fullName.trim(), position: position.trim() },
          {
            onSuccess: () => {
              toast(employee ? 'Изменения сохранены' : 'Сотрудник добавлен');
              onClose();
            },
          },
        );
      }}
    >
      <div className="modal-body form-stack">
        <p className="muted employee-form-note">
          Сотрудник появится в списке и станет доступен в таймере.
        </p>
        <label>
          <span>
            {page ? 'Полное имя' : 'Имя и фамилия'} <span className="required">*</span>
          </span>
          <input
            autoFocus
            required
            aria-invalid={!!nameError}
            minLength={2}
            maxLength={120}
            value={fullName}
            onChange={(e) => setName(e.target.value)}
            placeholder={page ? 'Имя и фамилия' : 'Например, Анна Миронова'}
          />
          {nameError && <small className="danger-text">{nameError}</small>}
        </label>
        <label>
          Должность
          <input
            maxLength={120}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder={page ? 'Необязательно' : 'Например, дизайнер'}
          />
        </label>
        <ErrorMessage error={mutation.error} />
      </div>
      <footer className="modal-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button disabled={mutation.isPending}>
          {mutation.isPending
            ? 'Сохраняем…'
            : employee
              ? 'Сохранить изменения'
              : 'Добавить сотрудника'}
        </Button>
      </footer>
    </form>
  );
  return page ? (
    <section className="mobile-form-page">{form}</section>
  ) : (
    <Modal title={employee ? 'Редактировать сотрудника' : 'Новый сотрудник'} onClose={onClose}>
      {form}
    </Modal>
  );
}
export function Employees() {
  const [search, setSearch] = useState(''),
    [archived, setArchived] = useState(false),
    [adding, setAdding] = useState(false);
  const query = useEmployees(archived, search);
  return (
    <>
      <PageTitle
        title="Сотрудники"
        description="Ваша команда и её рабочее время"
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={18} />
            Добавить сотрудника
          </Button>
        }
      />
      <section className="card">
        <div className="toolbar">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Поиск сотрудников"
              placeholder="Поиск по имени или должности"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Показывать архив
          </label>
        </div>
        <ErrorMessage error={query.error} />
        {query.isPending ? (
          <Loading />
        ) : query.data?.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Должность</th>
                    <th>Статус</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {query.data.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link className="person" to={`/employees/${e.id}`}>
                          <Avatar name={e.fullName} />
                          <strong>{e.fullName}</strong>
                        </Link>
                      </td>
                      <td>{e.position || 'Не указана'}</td>
                      <td>
                        <span className={`badge ${e.archivedAt ? 'neutral' : 'success'}`}>
                          {e.archivedAt ? 'В архиве' : 'В команде'}
                        </span>
                      </td>
                      <td>
                        <Link className="text-link" to={`/employees/${e.id}`}>
                          Открыть →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">Найдено сотрудников: {query.data.length}</div>
          </>
        ) : (
          !query.error && (
            <Empty
              title={search ? 'Никого не нашли' : 'Пока нет сотрудников'}
              description={
                search
                  ? 'Попробуйте другое имя или должность.'
                  : 'Добавьте первого сотрудника и начните учитывать время.'
              }
              action={
                <Button onClick={() => setAdding(true)}>
                  <Plus size={18} />
                  Добавить сотрудника
                </Button>
              }
            />
          )
        )}
      </section>
      {adding && <EmployeeForm onClose={() => setAdding(false)} />}
    </>
  );
}
export function Profile() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [edit, setEdit] = useState(false),
    [confirm, setConfirm] = useState(false),
    [page, setPage] = useState(1);
  const employee = useQuery({
    queryKey: ['employee', id],
    queryFn: () => api<Employee>(`/employees/${id}`),
  });
  const report = useReport({ ...defaultPeriod(), employeeId: id });
  const entries = useEntries({ employeeId: id, page });
  const mutation = useAction(() =>
    api(
      `/employees/${id}${employee.data?.archivedAt ? '/restore' : ''}`,
      employee.data?.archivedAt ? 'POST' : 'DELETE',
      {},
    ),
  );
  if (employee.isPending) return <Loading />;
  if (employee.error) return <ErrorMessage error={employee.error} />;
  const e = employee.data!;
  return (
    <>
      <Link to="/employees" className="back-link">
        <ArrowLeft size={16} />
        Все сотрудники
      </Link>
      <PageTitle
        title={e.fullName}
        description={e.position || 'Должность не указана'}
        action={
          <Button variant="secondary" onClick={() => setEdit(true)}>
            <Pencil size={16} />
            Редактировать
          </Button>
        }
      />
      <section className="card profile-card">
        <Avatar name={e.fullName} large />
        <div>
          <h2>{e.fullName}</h2>
          <p className="muted">В команде с {dateTime(e.createdAt).split(' ')[0]}</p>
          <span className={`badge ${e.archivedAt ? 'neutral' : 'success'}`}>
            {e.archivedAt ? 'В архиве' : 'В команде'}
          </span>
        </div>
        <div className="profile-actions">
          {!e.archivedAt && (
            <Link className="button primary" to={`/timer?employeeId=${id}`}>
              <Timer size={18} />
              Запустить таймер
            </Link>
          )}
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            {e.archivedAt ? <RotateCcw size={16} /> : <Archive size={16} />}{' '}
            {e.archivedAt ? 'Восстановить' : 'Архивировать'}
          </Button>
        </div>
      </section>
      <ErrorMessage error={report.error} />
      <div className="stats-grid three">
        <div className="stat card">
          <span>Время за 7 дней</span>
          <strong>{duration(report.data?.totalSeconds ?? 0)}</strong>
        </div>
        <div className="stat card">
          <span>Завершённые сессии за 7 дней</span>
          <strong>{report.data?.sessionCount ?? 0}</strong>
        </div>
        <div className="stat card">
          <span>Дней с записями за 7 дней</span>
          <strong>{report.data?.activeDays ?? 0}</strong>
        </div>
      </div>
      <section className="card">
        <div className="section-head">
          <h2>История времени</h2>
        </div>
        <ErrorMessage error={entries.error} />
        {entries.isPending ? (
          <Loading />
        ) : (
          <EntryTable data={entries.data} page={page} onPage={setPage} />
        )}
      </section>
      {edit && <EmployeeForm employee={e} onClose={() => setEdit(false)} />}
      {confirm && (
        <Confirm
          title={e.archivedAt ? 'Восстановить сотрудника?' : 'Архивировать сотрудника?'}
          pending={mutation.isPending}
          error={mutation.error}
          onClose={() => setConfirm(false)}
          onConfirm={() =>
            mutation.mutate(undefined, {
              onSuccess: () => {
                toast(e.archivedAt ? 'Сотрудник восстановлен' : 'Сотрудник архивирован');
                setConfirm(false);
              },
            })
          }
        >
          <p>
            {e.archivedAt
              ? 'Сотрудник снова сможет запускать таймер.'
              : 'Все записи сохранятся. Новые таймеры будут недоступны до восстановления сотрудника.'}
          </p>
        </Confirm>
      )}
    </>
  );
}
