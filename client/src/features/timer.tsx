import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Play, Square, Timer as TimerIcon, ShieldCheck } from 'lucide-react';
import type { Entry } from '../../../shared/types';
import { api, useAction, useActive, useEmployees } from '../lib/api';
import {
  Avatar,
  Button,
  Confirm,
  Empty,
  ErrorMessage,
  LiveDuration,
  Loading,
  PageTitle,
  useToast,
} from '../components/ui';
import { dateTime } from '../../../shared/time';
export function StopTimer({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const toast = useToast();
  const mutation = useAction(() => api(`/timer/${entry.id}/stop`, 'POST', {}));
  return (
    <Confirm
      title="Завершить рабочую сессию?"
      onClose={onClose}
      onConfirm={() =>
        mutation.mutate(undefined, {
          onSuccess: () => {
            toast('Таймер завершён. Запись сохранена');
            onClose();
          },
        })
      }
      pending={mutation.isPending}
      error={mutation.error}
      label="Завершить"
      danger
    >
      <p>
        <strong>{entry.fullName}</strong>
      </p>
      <p>{entry.description}</p>
      <div className="confirm-time">
        <LiveDuration startedAt={entry.startedAt} />
      </div>
      <p className="muted">Время будет сохранено в журнале.</p>
    </Confirm>
  );
}
export function ActiveList({ entries }: { entries: Entry[] }) {
  const [stop, setStop] = useState<Entry>();
  return (
    <>
      <div className="active-list">
        {entries.map((e) => (
          <div className="active-row" key={e.id}>
            <Avatar name={e.fullName ?? ''} />
            <div className="grow">
              <strong>{e.fullName}</strong>
              <p className="truncate muted">{e.description}</p>
            </div>
            <LiveDuration startedAt={e.startedAt} />
            <Button
              variant="secondary"
              aria-label={`Завершить таймер ${e.fullName}`}
              onClick={() => setStop(e)}
            >
              <Square size={15} />
              <span className="desktop-label">Завершить</span>
            </Button>
          </div>
        ))}
      </div>
      {stop && <StopTimer entry={stop} onClose={() => setStop(undefined)} />}
    </>
  );
}
export function TimerPage() {
  const [searchParams] = useSearchParams();
  const [employeeId, setEmployeeId] = useState(searchParams.get('employeeId') ?? ''),
    [description, setDescription] = useState(''),
    [confirm, setConfirm] = useState(false),
    [stop, setStop] = useState<Entry>();
  const employees = useEmployees(),
    active = useActive(),
    toast = useToast();
  const start = useAction(() =>
    api<Entry>('/timer/start', 'POST', { employeeId, description: description.trim() }),
  );
  const selectedId = employeeId || employees.data?.[0]?.id || '';
  const current = active.data?.find((e) => e.employeeId === selectedId);
  const others = active.data?.filter((e) => e.employeeId !== selectedId) ?? [];
  const selectedEmployee = employees.data?.find((e) => e.id === selectedId);
  return (
    <>
      <PageTitle title="Таймер" description="Сосредоточьтесь на работе — время мы посчитаем" />
      <ErrorMessage error={employees.error || active.error} />
      {employees.isPending || active.isPending ? (
        <Loading />
      ) : !employees.data?.length ? (
        <section className="card">
          <Empty
            title="Сначала добавьте сотрудника"
            description="Для учёта времени нужен хотя бы один участник команды."
            action={
              <Link className="button primary" to="/employees">
                Перейти к сотрудникам
              </Link>
            }
          />
        </section>
      ) : (
        <div className="timer-layout">
          <section className="card timer-card">
            <div className="timer-top">
              <span className={`badge ${current ? 'success' : 'neutral'}`}>
                {current ? (
                  <>
                    <i className="live-dot" />
                    Таймер работает
                  </>
                ) : (
                  'Готов к работе'
                )}
              </span>
              <TimerIcon size={22} />
            </div>
            <div className="timer-face">
              <div className={`timer-ring ${current ? 'running' : ''}`}>
                <TimerIcon size={28} />
                <div className="timer-digits">
                  {current ? (
                    <LiveDuration startedAt={current.startedAt} />
                  ) : (
                    <span className="digits">00:00:00</span>
                  )}
                </div>
                <span>{current ? 'Сессия в процессе' : 'Время для продуктивной работы'}</span>
              </div>
            </div>
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                setEmployeeId(selectedId);
                setConfirm(true);
              }}
            >
              <label>
                Сотрудник
                <select value={selectedId} onChange={(e) => setEmployeeId(e.target.value)} required>
                  {employees.data.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </select>
              </label>
              {current ? (
                <>
                  <div className="task-box">
                    <span className="eyebrow">ТЕКУЩАЯ ЗАДАЧА</span>
                    <p>{current.description}</p>
                    <small>Начало: {dateTime(current.startedAt)}</small>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={start.isPending}
                    onClick={() => setStop(current)}
                  >
                    <Square size={17} />
                    Завершить сессию
                  </Button>
                </>
              ) : (
                <>
                  <label>
                    Над чем вы работаете?
                    <textarea
                      required
                      maxLength={160}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Кратко опишите задачу…"
                      rows={3}
                    />
                    <small>{description.length}/160 символов</small>
                  </label>
                  <Button disabled={start.isPending || !!active.error}>
                    <Play size={18} />
                    {start.isPending ? 'Запускаем…' : 'Запустить таймер'}
                  </Button>
                </>
              )}
            </form>
            <p className="timer-note">
              <ShieldCheck size={15} />
              Сессия сохраняется при закрытии страницы
            </p>
          </section>
          <aside className="timer-aside">
            <section className="card">
              <div className="section-head">
                <h2>Сейчас в работе</h2>
                <span className="count">{active.data?.length ?? 0}</span>
              </div>
              {others.length ? (
                <ActiveList entries={others} />
              ) : (
                <Empty
                  title={current ? 'Работает один сотрудник' : 'Нет активных таймеров'}
                  description="Здесь появятся сессии других участников команды."
                />
              )}
            </section>
            <div className="tip-card">
              <h3>Каждая минута имеет значение</h3>
              <p>
                Укажите понятное описание задачи — так будет проще оценить результаты в отчётах.
              </p>
              <Link to="/reports" className="text-link">
                Перейти к отчётам →
              </Link>
            </div>
          </aside>
        </div>
      )}
      {confirm && (
        <Confirm
          title="Запустить таймер?"
          pending={start.isPending}
          error={start.error}
          onClose={() => setConfirm(false)}
          label="Запустить"
          onConfirm={() =>
            start.mutate(undefined, {
              onSuccess: () => {
                toast('Таймер запущен');
                setDescription('');
                setConfirm(false);
              },
            })
          }
        >
          <p>
            <strong>{selectedEmployee?.fullName}</strong>
          </p>
          <p>{description}</p>
        </Confirm>
      )}
      {stop && <StopTimer entry={stop} onClose={() => setStop(undefined)} />}
    </>
  );
}
