import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Timer, Play, Square } from 'lucide-react';
import type { Entry } from '../../../../shared/types';
import { api, useAction, useActive, useEmployees } from '../../lib/api';
import { Button, Empty, ErrorMessage, LiveDuration, Loading, useToast } from '../../components/ui';
import { StopTimer } from '../timer';

export function MobileTimer() {
  const [params] = useSearchParams(),
    [stop, setStop] = useState<Entry>();
  const employees = useEmployees(),
    active = useActive();
  const selected =
    params.get('employeeId') || active.data?.[0]?.employeeId || employees.data?.[0]?.id;
  const current = active.data?.find((e) => e.employeeId === selected),
    others = active.data?.filter((e) => e.id !== current?.id) ?? [];
  if (employees.isPending || active.isPending) return <Loading />;
  return (
    <div className={`mobile-screen mobile-timer ${current ? 'is-running' : 'is-idle'}`}>
      <ErrorMessage error={employees.error || active.error} />
      {current ? (
        <>
          <div className="mobile-session-status">
            <i className="live-dot" />
            Сессия активна
          </div>
          <section className="mobile-panel mobile-running-card">
            <span className="mobile-running-label">В РАБОТЕ</span>
            <div className="timer-digits">
              <LiveDuration startedAt={current.startedAt} />
            </div>
            <div className="mobile-time-units">
              <span>Часы</span>
              <span>Минуты</span>
              <span>Секунды</span>
            </div>
            <div className="mobile-task">
              <span>СОТРУДНИК</span>
              <strong>{current.fullName}</strong>
              <span>ЗАДАЧА</span>
              <p>{current.description}</p>
            </div>
            <Button variant="danger" aria-label="Завершить сессию" onClick={() => setStop(current)}>
              <Square size={13} />
              Завершить работу
            </Button>
          </section>
          <p className="mobile-save-note">Таймер продолжится после перезагрузки.</p>
        </>
      ) : (
        <>
          <section className="mobile-panel mobile-idle-card">
            <span className="mobile-timer-icon">
              <Timer size={26} />
            </span>
            <h2>Таймер не запущен</h2>
            <p>Выберите сотрудника и задачу, чтобы начать.</p>
            <Link
              className="button primary"
              to={`/timer/new${selected ? `?employeeId=${selected}` : ''}`}
            >
              <Play size={14} />
              Запустить таймер
            </Link>
          </section>
          <p className="mobile-save-note">После обновления браузера данные остаются сохранены.</p>
        </>
      )}
      {others.length > 0 && (
        <section className="mobile-other-timers">
          <h2>Другие сессии</h2>
          {others.map((e) => (
            <Link key={e.id} className="mobile-record" to={`/timer?employeeId=${e.employeeId}`}>
              <span className="grow">{e.fullName}</span>
              <LiveDuration startedAt={e.startedAt} />
            </Link>
          ))}
        </section>
      )}
      {stop && <StopTimer entry={stop} onClose={() => setStop(undefined)} />}
    </div>
  );
}
export function MobileStartTimer() {
  const [params] = useSearchParams(),
    navigate = useNavigate(),
    toast = useToast();
  const employees = useEmployees(),
    active = useActive();
  const [employeeId, setEmployee] = useState(params.get('employeeId') ?? ''),
    [description, setDescription] = useState('');
  const selected =
    employeeId ||
    employees.data?.find((e) => !active.data?.some((t) => t.employeeId === e.id))?.id ||
    '';
  const mutation = useAction(() =>
    api<Entry>('/timer/start', 'POST', { employeeId: selected, description: description.trim() }),
  );
  if (employees.isPending || active.isPending) return <Loading />;
  if (employees.error || active.error)
    return <ErrorMessage error={employees.error || active.error} />;
  if (!employees.data?.length)
    return (
      <Empty
        title="Сначала добавьте сотрудника"
        action={
          <Link className="button primary" to="/employees/new">
            Добавить сотрудника
          </Link>
        }
      />
    );
  return (
    <div className="mobile-screen mobile-start">
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(undefined, {
            onSuccess: () => {
              toast('Таймер запущен');
              navigate(`/timer?employeeId=${selected}`, { replace: true });
            },
          });
        }}
      >
        <label>
          Сотрудник *
          <select required value={selected} onChange={(e) => setEmployee(e.target.value)}>
            <option value="">Выберите сотрудника</option>
            {employees.data.map((e) => (
              <option
                value={e.id}
                key={e.id}
                disabled={active.data?.some((t) => t.employeeId === e.id)}
              >
                {e.fullName}
                {active.data?.some((t) => t.employeeId === e.id) ? ' · в работе' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Описание задачи *
          <textarea
            aria-label="Над чем вы работаете?"
            required
            maxLength={160}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Например, разработка главной страницы"
            rows={1}
          />
        </label>
        <p className="mobile-form-help">Сначала выберите сотрудника, затем укажите задачу.</p>
        <ErrorMessage error={mutation.error} />
        <div className="mobile-form-actions">
          <Button disabled={mutation.isPending || !selected}>
            <Play size={14} />
            {mutation.isPending ? 'Запускаем…' : 'Запустить таймер'}
          </Button>
          <Link className="button secondary" to="/timer">
            Отмена
          </Link>
        </div>
      </form>
    </div>
  );
}
