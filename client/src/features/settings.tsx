import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, Download, Upload, ShieldCheck, Trash2, HardDrive } from 'lucide-react';
import { api, download, useAction } from '../lib/api';
import { Button, ErrorMessage, Loading, Modal, PageTitle, useToast } from '../components/ui';
import { useMobileLayout } from '../lib/useMobileLayout';
export function Settings() {
  const mobile = useMobileLayout();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<{ storage: string; timeZone: string; demoMode: boolean }>('/health'),
  });
  const [error, setError] = useState<unknown>(),
    [exporting, setExporting] = useState(false),
    [backup, setBackup] = useState<unknown>(),
    [fileName, setFileName] = useState('');
  const [stage, setStage] = useState(0),
    [confirmation, setConfirmation] = useState('');
  const input = useRef<HTMLInputElement>(null),
    toast = useToast();
  const reset = useAction(() => api('/settings/reset', 'POST', { confirm: confirmation }));
  const restore = useAction(() =>
    api('/backups/import', 'POST', { confirm: confirmation, mode: 'replace', backup }),
  );
  const disabled = health.data?.demoMode || health.isPending || !!health.error;
  const exportBackup = async () => {
    setError(undefined);
    setExporting(true);
    try {
      await download('/backups/export', 'worktime-backup.json');
      toast('Резервная копия скачана');
    } catch (e) {
      setError(e);
    } finally {
      setExporting(false);
    }
  };
  const backupInput = (
    <input
      ref={input}
      className="hidden"
      type="file"
      accept=".json,application/json"
      aria-label="Файл резервной копии"
      onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        setError(undefined);
        try {
          if (f.size > 19 * 1024 * 1024) throw new Error('Файл должен быть меньше 19 МБ');
          setBackup(JSON.parse(await f.text()));
          setFileName(f.name);
          setConfirmation('');
          restore.reset();
        } catch (err) {
          setError(err instanceof SyntaxError ? new Error('Файл содержит повреждённый JSON') : err);
        }
      }}
    />
  );
  return (
    <>
      {!mobile && (
        <PageTitle title="Настройки" description="Хранение данных и резервное копирование" />
      )}
      <ErrorMessage error={error || health.error} />
      {backupInput}
      {health.isPending ? (
        <Loading />
      ) : mobile ? (
        <div className="mobile-screen mobile-settings">
          <section className="mobile-panel">
            <h2>Хранение данных</h2>
            <p className="mobile-storage-status">Постоянное хранение включено</p>
            <p>Данные сохраняются локально в SQLite.</p>
            <Button
              variant="secondary"
              onClick={exportBackup}
              disabled={exporting || !!health.error}
            >
              <Download size={14} />
              {exporting ? 'Скачиваем…' : 'Резервная копия JSON'}
            </Button>
          </section>
          <section className="mobile-panel">
            <h2>Восстановление данных</h2>
            <p>Заменить текущие данные из резервной копии.</p>
            <Button disabled={disabled} onClick={() => input.current?.click()}>
              <Upload size={14} />
              Импорт JSON
            </Button>
            {health.data?.demoMode && <p className="danger-text">Импорт отключён в демо-режиме.</p>}
          </section>
          <section className="mobile-panel mobile-danger-panel">
            <h2>Очистка приложения</h2>
            <p>Все данные будут удалены.</p>
            <Button
              variant="danger"
              aria-label="Очистить данные"
              disabled={disabled}
              onClick={() => {
                setStage(1);
                setConfirmation('');
                reset.reset();
              }}
            >
              Удалить данные
            </Button>
            {health.data?.demoMode && (
              <p className="danger-text">Очистка отключена в демо-режиме.</p>
            )}
          </section>
        </div>
      ) : (
        <>
          <section className="card settings-card">
            <div className="settings-icon">
              <Database size={24} />
            </div>
            <div className="grow">
              <h2>Ваши данные — у вас</h2>
              <p>Данные хранятся локально в SQLite и сохраняются после перезапуска приложения.</p>
              <span className="badge success">
                <ShieldCheck size={14} />
                Постоянное хранение
              </span>
            </div>
            <HardDrive size={32} className="muted" />
          </section>
          <section className="card">
            <div className="section-head">
              <h2>Резервные копии</h2>
            </div>
            <div className="setting-row">
              <div>
                <h3>Скачать резервную копию</h3>
                <p>Все сотрудники и записи в JSON. Сохраните копию перед изменением данных.</p>
              </div>
              <Button
                variant="secondary"
                disabled={exporting || !!health.error}
                onClick={exportBackup}
              >
                <Download size={17} />
                {exporting ? 'Скачиваем…' : 'Скачать JSON'}
              </Button>
            </div>
            <div className="setting-row">
              <div>
                <h3>Восстановить из копии</h3>
                <p>Режим замены: текущие сотрудники и записи будут заменены данными из файла.</p>
                {health.data?.demoMode && (
                  <p className="danger-text">Импорт отключён в демо-режиме.</p>
                )}
              </div>
              <Button
                variant="secondary"
                disabled={disabled}
                onClick={() => input.current?.click()}
              >
                <Upload size={17} />
                Импорт JSON
              </Button>
            </div>
          </section>
          <section className="card">
            <div className="section-head">
              <h2>Параметры приложения</h2>
            </div>
            <div className="setting-row">
              <div>
                <h3>Часовой пояс</h3>
                <p>Душанбе · Asia/Dushanbe (UTC+5)</p>
              </div>
              <span className="badge neutral">Единый для всех отчётов</span>
            </div>
            <div className="setting-row">
              <div>
                <h3>Версия приложения</h3>
                <p>WorkTime 1.0.0 · React + SQLite</p>
              </div>
            </div>
          </section>
          <section className="card danger-card">
            <div className="setting-row">
              <div>
                <h3>Очистить все данные</h3>
                <p>
                  Сотрудники, записи и активные таймеры будут удалены без возможности
                  восстановления.
                </p>
                {health.data?.demoMode && (
                  <p className="danger-text">Очистка отключена в демо-режиме.</p>
                )}
              </div>
              <Button
                variant="danger"
                disabled={disabled}
                onClick={() => {
                  setStage(1);
                  setConfirmation('');
                  reset.reset();
                }}
              >
                <Trash2 size={17} />
                Очистить данные
              </Button>
            </div>
          </section>
        </>
      )}
      {stage > 0 && (
        <Modal
          title={stage === 1 ? 'Удалить все данные?' : 'Подтвердите очистку'}
          onClose={() => setStage(0)}
        >
          <div className="modal-body form-stack">
            {stage === 1 ? (
              <>
                <p>Будут удалены все сотрудники и история времени, включая активные сессии.</p>
                <p>Перед продолжением скачайте резервную копию.</p>
              </>
            ) : (
              <label>
                Для подтверждения введите УДАЛИТЬ
                <input
                  autoFocus
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="УДАЛИТЬ"
                />
              </label>
            )}
            <ErrorMessage error={reset.error} />
          </div>
          <footer className="modal-actions">
            <Button variant="secondary" onClick={() => setStage(0)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              disabled={reset.isPending || (stage === 2 && confirmation !== 'УДАЛИТЬ')}
              onClick={() => {
                if (stage === 1) {
                  setStage(2);
                  return;
                }
                reset.mutate(undefined, {
                  onSuccess: () => {
                    setStage(0);
                    toast('Данные очищены');
                  },
                });
              }}
            >
              {reset.isPending ? 'Удаляем…' : stage === 1 ? 'Продолжить' : 'Удалить всё'}
            </Button>
          </footer>
        </Modal>
      )}
      {backup !== undefined && (
        <Modal title="Заменить данные из копии?" onClose={() => setBackup(undefined)}>
          <div className="modal-body form-stack">
            <p>
              Файл: <strong>{fileName}</strong>. Текущие данные будут полностью заменены после
              проверки файла сервером.
            </p>
            <label>
              Введите ЗАМЕНИТЬ
              <input
                autoFocus
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="ЗАМЕНИТЬ"
              />
            </label>
            <ErrorMessage error={restore.error} />
          </div>
          <footer className="modal-actions">
            <Button variant="secondary" onClick={() => setBackup(undefined)}>
              Отмена
            </Button>
            <Button
              disabled={restore.isPending || confirmation !== 'ЗАМЕНИТЬ'}
              onClick={() =>
                restore.mutate(undefined, {
                  onSuccess: () => {
                    setBackup(undefined);
                    toast('Резервная копия восстановлена');
                  },
                })
              }
            >
              {restore.isPending ? 'Восстанавливаем…' : 'Заменить данные'}
            </Button>
          </footer>
        </Modal>
      )}
    </>
  );
}
