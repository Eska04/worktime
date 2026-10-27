import { NavLink, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Timer,
  Users,
  ListChecks,
  BarChart3,
  Settings as SettingsIcon,
  Clock3,
  ArrowUpRight,
} from 'lucide-react';
import { Dashboard } from '../features/dashboard';
import { TimerPage } from '../features/timer';
import { Employees, EmployeeForm, Profile } from '../features/employees';
import { Entries } from '../features/entries';
import { Reports } from '../features/reports';
import { Settings } from '../features/settings';
import { Empty } from '../components/ui';
import { today } from '../../../shared/time';
import { useMobileLayout } from '../lib/useMobileLayout';
import { MobileDashboard } from '../features/mobile/dashboard';
import { MobileTimer, MobileStartTimer } from '../features/mobile/timer';
import { MobileEmployees } from '../features/mobile/employees';
import { MobileEntries } from '../features/mobile/entries';
import { MobileReports } from '../features/mobile/reports';
const nav = [
  { path: '/', label: 'Обзор', mobile: 'Обзор', icon: LayoutDashboard },
  { path: '/timer', label: 'Таймер', mobile: 'Таймер', icon: Timer },
  { path: '/employees', label: 'Сотрудники', mobile: 'Команда', icon: Users },
  { path: '/entries', label: 'Записи времени', mobile: 'Журнал', icon: ListChecks },
  { path: '/reports', label: 'Отчёты', mobile: 'Отчёты', icon: BarChart3 },
];
export default function App() {
  const location = useLocation();
  const mobile = useMobileLayout(),
    navigate = useNavigate();
  const section =
    nav.find((n) =>
      n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path),
    )?.label ?? 'Настройки';
  const mobileTitle =
    location.pathname === '/timer/new'
      ? 'Новая сессия'
      : location.pathname === '/employees/new'
        ? 'Новый сотрудник'
        : section;
  const profilePage = /^\/employees\/(?!new$).+/.test(location.pathname);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        К содержимому
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-icon">
            <Clock3 size={23} />
          </span>
          Work<span>Time</span>
        </Link>
        <span className="nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</span>
        <nav aria-label="Основная навигация">
          {nav.map((n) => (
            <NavLink key={n.path} to={n.path} end={n.path === '/'}>
              <n.icon size={20} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-note">
            <span className="storage-dot" />
            <div>
              Локальное пространство<small>Данные сохраняются в SQLite</small>
            </div>
          </div>
          <NavLink to="/settings">
            <SettingsIcon size={20} />
            Настройки
          </NavLink>
          <div className="sidebar-version">
            WorkTime <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Рабочее пространство</span>
            <span>/</span>
            <strong>{section}</strong>
          </div>
          <Link className="mobile-brand" to="/">
            <Clock3 size={23} />
            WorkTime
          </Link>
          <div className="topbar-right">
            <span className="local-label">
              <i />
              Локальный режим
            </span>
            <span className="header-date">{today().split('-').reverse().join('.')}</span>
            <Link className="settings-link" aria-label="Настройки" to="/settings">
              <SettingsIcon size={20} />
            </Link>
          </div>
          {mobile &&
            (profilePage ? (
              <div className="mobile-screen-title">{mobileTitle}</div>
            ) : (
              <h1 className="mobile-screen-title">{mobileTitle}</h1>
            ))}
        </header>
        <main id="main" tabIndex={-1}>
          <Routes>
            <Route path="/" element={mobile ? <MobileDashboard /> : <Dashboard />} />
            <Route path="/timer" element={mobile ? <MobileTimer /> : <TimerPage />} />
            <Route path="/timer/new" element={mobile ? <MobileStartTimer /> : <TimerPage />} />
            <Route path="/employees" element={mobile ? <MobileEmployees /> : <Employees />} />
            <Route
              path="/employees/new"
              element={<EmployeeForm page={mobile} onClose={() => navigate('/employees')} />}
            />
            <Route path="/employees/:id" element={<Profile />} />
            <Route path="/entries" element={mobile ? <MobileEntries /> : <Entries />} />
            <Route path="/reports" element={mobile ? <MobileReports /> : <Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="*"
              element={
                <Empty
                  title="Страница не найдена"
                  action={
                    <Link className="button primary" to="/">
                      На главную <ArrowUpRight size={16} />
                    </Link>
                  }
                />
              }
            />
          </Routes>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Мобильная навигация">
        {nav.map((n) => (
          <NavLink key={n.path} to={n.path} end={n.path === '/'}>
            <n.icon size={21} />
            <span>{n.mobile}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
