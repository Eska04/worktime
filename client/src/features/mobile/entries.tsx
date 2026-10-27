import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Entry } from '../../../../shared/types';
import { dateTime, duration } from '../../../../shared/time';
import { api, useAction, useEmployees, useEntries } from '../../lib/api';
import {
  Button,
  Confirm,
  Empty,
  ErrorMessage,
  LiveDuration,
  Loading,
  Modal,
  useToast,
} from '../../components/ui';
import { EntryForm } from '../entries';
import { StopTimer } from '../timer';
import { MobileEntryRow, MobilePeriod } from './common';
const initial = { employeeId: '', startDate: '', endDate: '', status: 'all' };

export function MobileEntries() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState(initial),
    [filters, setFilters] = useState(initial),
    [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false),
    [selected, setSelected] = useState<Entry>(),
    [edit, setEdit] = useState<Entry>(),
    [remove, setRemove] = useState<Entry>(),
    [stop, setStop] = useState<Entry>();
  const employees = useEmployees(true),
    entries = useEntries({ ...filters, page }),
    toast = useToast();
  const detailId = searchParams.get('entryId');
  const deepEntry = useQuery({
    queryKey: ['entry', detailId],
    queryFn: () => api<Entry>(`/entries/${detailId}`),
    enabled: !!detailId,
  });
  const detail = selected ?? (detailId ? deepEntry.data : undefined);
  const closeDetail = () => {
    setSelected(undefined);
    if (detailId) setSearchParams({}, { replace: true });
  };
  const deletion = useAction(() => api(`/entries/${remove!.id}`, 'DELETE', {}));
  return (
    <div className="mobile-screen mobile-journal">
      <label>
        Сотрудник
        <select
          value={draft.employeeId}
          onChange={(e) => {
            const next = { ...draft, employeeId: e.target.value };
            setDraft(next);
            setFilters(next);
            setPage(1);
          }}
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
      <MobilePeriod
        startDate={draft.startDate}
        endDate={draft.endDate}
        onStart={(v) => setDraft({ ...draft, startDate: v })}
        onEnd={(v) => setDraft({ ...draft, endDate: v })}
        onApply={() => {
          setFilters(draft);
          setPage(1);
        }}
      >
        <label>
          Статус
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          >
            <option value="all">Все записи</option>
            <option value="completed">Завершённые</option>
            <option value="active">В работе</option>
          </select>
        </label>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setDraft(initial);
            setFilters(initial);
            setPage(1);
          }}
        >
          Сбросить
        </Button>
      </MobilePeriod>
      <ErrorMessage
        error={entries.error || employees.error || (detailId ? deepEntry.error : null)}
      />
      {entries.isPending ? (
        <Loading />
      ) : (
        !entries.error && (
          <>
            <p className="mobile-list-count">Найдено {entries.data?.total ?? 0} записей</p>
            {entries.data?.items.length ? (
              <div className="mobile-record-list">
                {entries.data.items.map((entry) => (
                  <MobileEntryRow key={entry.id} entry={entry} onClick={() => setSelected(entry)} />
                ))}
              </div>
            ) : (
              <Empty
                title="Нет записей за выбранный период"
                description="Начните сессию или добавьте запись вручную."
              />
            )}
            {entries.data && entries.data.total > entries.data.pageSize && (
              <div className="mobile-pagination">
                <Button
                  variant="secondary"
                  disabled={page === 1}
                  aria-label="Предыдущая страница"
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span>
                  {page} / {Math.ceil(entries.data.total / entries.data.pageSize)}
                </span>
                <Button
                  variant="secondary"
                  aria-label="Следующая страница"
                  disabled={page * entries.data.pageSize >= entries.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            )}
          </>
        )
      )}
      <Button
        variant="secondary"
        className="mobile-add-entry"
        aria-label="Новая запись"
        onClick={() => setAdding(true)}
      >
        <Plus size={14} />
        Добавить запись
      </Button>
      {adding && <EntryForm onClose={() => setAdding(false)} />}
      {edit && <EntryForm entry={edit} onClose={() => setEdit(undefined)} />}
      {detail && (
        <Modal title="Подробности записи" onClose={closeDetail}>
          <div className="modal-body details">
            <p>
              <span>Сотрудник</span>
              <strong>{detail.fullName}</strong>
            </p>
            <p>
              <span>Задача</span>
              {detail.description}
            </p>
            <p>
              <span>Начало · Душанбе</span>
              {dateTime(detail.startedAt)}
            </p>
            <p>
              <span>Окончание · Душанбе</span>
              {detail.endedAt ? dateTime(detail.endedAt) : 'В работе'}
            </p>
            <p>
              <span>Длительность</span>
              {detail.endedAt ? (
                duration(detail.durationSeconds ?? 0)
              ) : (
                <LiveDuration startedAt={detail.startedAt} />
              )}
            </p>
          </div>
          <footer className="modal-actions mobile-entry-actions">
            {detail.endedAt ? (
              <>
                <Button
                  variant="secondary"
                  aria-label={`Редактировать запись ${detail.description}`}
                  onClick={() => {
                    setEdit(detail);
                    closeDetail();
                  }}
                >
                  <Pencil size={16} />
                  Редактировать
                </Button>
                <Button
                  variant="danger"
                  aria-label={`Удалить запись ${detail.description}`}
                  onClick={() => {
                    setRemove(detail);
                    closeDetail();
                  }}
                >
                  <Trash2 size={16} />
                  Удалить
                </Button>
              </>
            ) : (
              <Button
                variant="danger"
                onClick={() => {
                  setStop(detail);
                  closeDetail();
                }}
              >
                Завершить сессию
              </Button>
            )}
          </footer>
        </Modal>
      )}
      {remove && (
        <Confirm
          title="Удалить запись?"
          danger
          label="Удалить запись"
          onClose={() => setRemove(undefined)}
          pending={deletion.isPending}
          error={deletion.error}
          onConfirm={() =>
            deletion.mutate(undefined, {
              onSuccess: () => {
                toast('Запись удалена');
                setRemove(undefined);
              },
            })
          }
        >
          <p>Запись «{remove.description}» будет удалена без возможности восстановления.</p>
        </Confirm>
      )}
      {stop && <StopTimer entry={stop} onClose={() => setStop(undefined)} />}
    </div>
  );
}
