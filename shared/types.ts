export interface Employee {
  id: string;
  fullName: string;
  position: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}
export interface Entry {
  id: string;
  employeeId: string;
  description: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  fullName?: string;
  position?: string;
  durationSeconds?: number;
}
export interface EntryPage {
  items: Entry[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Report {
  startDate: string;
  endDate: string;
  totalSeconds: number;
  sessionCount: number;
  employeeCount: number;
  activeDays: number;
  averagePerActiveDay: number;
  daily: { date: string; seconds: number }[];
  byEmployee: { employeeId: string; fullName: string; seconds: number; sessionCount: number }[];
}
