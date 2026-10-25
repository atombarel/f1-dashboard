import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import clsx from 'clsx'
import { homeQuery } from '@/lib/api'

function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="Pit Wall — accueil">
      <svg viewBox="0 0 40 24" className="h-6 w-10" aria-hidden>
        <path d="M0 24 L10 0 H40 L36 9 H17 L15 14 H31 L27 24 Z" fill="var(--color-signal)" className="origin-left transition-transform duration-300 group-hover:scale-x-110" />
        <path d="M2 24 L12 0" stroke="var(--color-ink)" strokeWidth="2" />
      </svg>
      <span className="display text-2xl tracking-tight">
        Pit<span className="text-signal">/</span>Wall
      </span>
    </Link>
  )
}

function NavLink({ to, params, children, active }: { to: string; params?: Record<string, unknown>; children: React.ReactNode; active: boolean }) {
  return (
    <Link
      to={to}
      params={params as never}
      className={clsx(
        'relative px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors',
        active ? 'text-paper' : 'text-muted hover:text-paper',
      )}
    >
      {children}
      {active && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 bg-signal" />}
    </Link>
  )
}

export function Layout() {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const { data: home } = useQuery(homeQuery())
  const year = home?.year ?? new Date().getFullYear()
  const live = home?.live

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="h-0.5 bg-gradient-to-r from-signal via-signal/40 to-transparent" />
      <header className="sticky top-0 z-50 border-b border-line bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="flex items-center overflow-x-auto">
            <NavLink to="/" active={path === '/'}>
              Accueil
            </NavLink>
            <NavLink to="/saison/$year" params={{ year }} active={path.startsWith('/saison') || path.startsWith('/gp') || path.startsWith('/session')}>
              Saison
            </NavLink>
            <NavLink to="/classements/$year" params={{ year }} active={path.startsWith('/classements')}>
              Classements
            </NavLink>
          </nav>
          <div className="ml-auto hidden items-center gap-3 sm:flex">
            {live ? (
              <Link
                to="/session/$sessionKey"
                params={{ sessionKey: live.session.key }}
                className="flex items-center gap-2 border border-signal/50 bg-signal-soft px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-signal"
              >
                <span className="animate-pulse-dot size-1.5 rounded-full bg-signal" />
                {live.meeting.name.replace('Grand Prix', 'GP')} · {live.session.name}
              </Link>
            ) : (
              home?.next && (
                <span className="font-mono text-[11px] uppercase tracking-wider text-dim">
                  Prochain : <span className="text-muted">{home.next.meeting.name.replace('Grand Prix', 'GP')}</span>
                </span>
              )
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-dim sm:px-6">
          <span>
            Données : <a className="link-underline text-muted" href="https://openf1.org" target="_blank" rel="noreferrer">OpenF1</a>,{' '}
            <a className="link-underline text-muted" href="https://github.com/jolpica/jolpica-f1" target="_blank" rel="noreferrer">Jolpica-F1</a>,{' '}
            <a className="link-underline text-muted" href="https://multiviewer.app" target="_blank" rel="noreferrer">MultiViewer</a>. Site non officiel, sans lien avec la Formule 1.
          </span>
          <span className="font-mono uppercase tracking-wider">Servi depuis le réseau Cloudflare</span>
        </div>
      </footer>
    </div>
  )
}
