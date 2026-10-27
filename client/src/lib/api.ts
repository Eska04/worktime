import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Employee, Entry, EntryPage, Report } from '../../../shared/types';
export class ApiError extends Error {
  constructor(
    message: string,
    public details?: { path: string[]; message: string }[],
  ) {
    super(message);
  }
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(
      'Нет связи с сервером. Проверьте, запущен ли WorkTime, и повторите действие.',
    );
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(
      data?.error?.message ?? 'Сервер не смог выполнить запрос',
      data?.error?.details,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
export function params(values: Record<string, string | number | undefined>) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
export const useEmployees = (includeArchived = false, search = '') =>
  useQuery({
    queryKey: ['employees', includeArchived, search],
    queryFn: () =>
      api<Employee[]>(`/employees?${params({ includeArchived: String(includeArchived), search })}`),
  });
export const useActive = () =>
  useQuery({
    queryKey: ['active'],
    queryFn: () => api<Entry[]>('/timer/active'),
    refetchInterval: 10000,
  });
export const useEntries = (filters: Record<string, string | number | undefined>) =>
  useQuery({
    queryKey: ['entries', filters],
    queryFn: () => api<EntryPage>(`/entries?${params(filters)}`),
  });
export const useReport = (filters: Record<string, string | undefined>) =>
  useQuery({
    queryKey: ['report', filters],
    queryFn: () => api<Report>(`/reports/summary?${params(filters)}`),
  });
export function useAction<T, V>(fn: (values: V) => Promise<T>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => client.invalidateQueries() });
}
export async function download(path: string, filename: string) {
  let res: Response;
  try {
    res = await fetch(`/api${path}`);
  } catch {
    throw new ApiError('Не удалось скачать файл: сервер недоступен');
  }
  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw new ApiError(error?.error?.message ?? 'Не удалось скачать файл');
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
