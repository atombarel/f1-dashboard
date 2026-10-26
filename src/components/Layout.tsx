import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import clsx from 'clsx'
import { getLang, LANGS, setLang, t } from '@/i18n'
import { sessionName } from '@/i18n/helpers'
import { homeQuery } from '@/lib/api'

function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label={t('nav.homeAria')}>
      <svg viewBox="0 0 40 24" className="h-6 w-10" aria-hidden>
        <path d="M0 24 L10 0 H40 L36 9 H17 L15 14 H31 L27 24 Z" fill="var(--color-signal)" className="origin-left transition-transform duration-300 group-hover:scale-x-110" />
        <path d="M2 24 L12 0" stroke="var(--color-ink)" strokeWidth="2" />
      </svg>
      <span className="display hidden text-2xl tracking-tight min-[440px]:inline">
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
        'relative px-2 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors sm:px-3 sm:tracking-[0.16em]',
        active ? 'text-paper' : 'text-muted hover:text-paper',
      )}
    >
      {children}
      {active && <span className="absolute inset-x-2 -bottom-[13px] h-0.5 bg-signal sm:inset-x-3" />}
    </Link>
  )
}

function LangSwitch() {
  const lang = getLang()
  return (
    <div className="ml-auto flex shrink-0 border border-line bg-carbon p-0.5 sm:ml-0" role="group" aria-label={t('nav.language')}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          lang={l.code}
          title={l.name}
          aria-pressed={l.code === lang}
          onClick={() => setLang(l.code)}
          className={clsx(
            'px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors',
            l.code === lang ? 'bg-paper text-ink' : 'text-muted hover:text-paper',
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
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
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:gap-6 sm:px-6">
          <Logo />
          <nav className="flex items-center overflow-x-auto">
            <NavLink to="/" active={path === '/'}>
              {t('nav.home')}
            </NavLink>
            <NavLink to="/saison/$year" params={{ year }} active={path.startsWith('/saison') || path.startsWith('/gp') || path.startsWith('/session')}>
              {t('nav.season')}
            </NavLink>
            <NavLink to="/classements/$year" params={{ year }} active={path.startsWith('/classements')}>
              {t('nav.standings')}
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
                {live.meeting.name.replace('Grand Prix', 'GP')} · {sessionName(live.session.name)}
              </Link>
            ) : (
              home?.next && (
                <span className="font-mono text-[11px] uppercase tracking-wider text-dim">
                  {t('nav.next')} <span className="text-muted">{home.next.meeting.name.replace('Grand Prix', 'GP')}</span>
                </span>
              )
            )}
          </div>
          <LangSwitch />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-dim sm:px-6">
          <span>
            {t('footer.data')} <a className="link-underline text-muted" href="https://openf1.org" target="_blank" rel="noreferrer">OpenF1</a>,{' '}
            <a className="link-underline text-muted" href="https://github.com/jolpica/jolpica-f1" target="_blank" rel="noreferrer">Jolpica-F1</a>,{' '}
            <a className="link-underline text-muted" href="https://multiviewer.app" target="_blank" rel="noreferrer">MultiViewer</a>. {t('footer.disclaimer')}
          </span>
          <span className="font-mono uppercase tracking-wider">{t('footer.servedBy')}</span>
        </div>
      </footer>
    </div>
  )
}
