import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, createRoute, createRouter, lazyRouteComponent } from '@tanstack/react-router'
import { Layout } from './components/Layout'
import { NotFound, RouteError } from './components/ui'
import { homeQuery, meetingQuery, seasonQuery, sessionMetaQuery, standingsQuery } from './lib/api'

export type SessionTab = 'results' | 'laps' | 'race' | 'strategy' | 'telemetry' | 'replay' | 'control'
const TABS: SessionTab[] = ['results', 'laps', 'race', 'strategy', 'telemetry', 'replay', 'control']

export interface SessionSearch {
  tab?: SessionTab
  /** comma separated driver numbers */
  d?: string
  /** telemetry laps, "1:12,16:fast" */
  laps?: string
}

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Layout,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
})

// Loaders only *start* the queries (ensureQueryData with no await on heavy data), so navigation is instant
// and preloading on hover warms the cache.
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  loader: ({ context }) => void context.queryClient.prefetchQuery(homeQuery()),
  component: lazyRouteComponent(() => import('./routes/home'), 'HomePage'),
})

const seasonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/saison/$year',
  params: { parse: (p) => ({ year: Number(p.year) }), stringify: (p) => ({ year: String(p.year) }) },
  loader: ({ context, params }) => void context.queryClient.prefetchQuery(seasonQuery(params.year)),
  component: lazyRouteComponent(() => import('./routes/season'), 'SeasonPage'),
})

const meetingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/gp/$meetingKey',
  params: { parse: (p) => ({ meetingKey: Number(p.meetingKey) }), stringify: (p) => ({ meetingKey: String(p.meetingKey) }) },
  loader: ({ context, params }) => void context.queryClient.prefetchQuery(meetingQuery(params.meetingKey)),
  component: lazyRouteComponent(() => import('./routes/meeting'), 'MeetingPage'),
})

export const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/session/$sessionKey',
  params: { parse: (p) => ({ sessionKey: Number(p.sessionKey) }), stringify: (p) => ({ sessionKey: String(p.sessionKey) }) },
  validateSearch: (s: Record<string, unknown>): SessionSearch => ({
    tab: TABS.includes(s.tab as SessionTab) ? (s.tab as SessionTab) : undefined,
    d: typeof s.d === 'string' || typeof s.d === 'number' ? String(s.d) : undefined,
    laps: typeof s.laps === 'string' ? s.laps : undefined,
  }),
  loader: ({ context, params }) => void context.queryClient.prefetchQuery(sessionMetaQuery(params.sessionKey)),
  component: lazyRouteComponent(() => import('./routes/session'), 'SessionPage'),
})

const standingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/classements/$year',
  params: { parse: (p) => ({ year: Number(p.year) }), stringify: (p) => ({ year: String(p.year) }) },
  loader: ({ context, params }) => void context.queryClient.prefetchQuery(standingsQuery(params.year)),
  component: lazyRouteComponent(() => import('./routes/standings'), 'StandingsPage'),
})

const routeTree = rootRoute.addChildren([homeRoute, seasonRoute, meetingRoute, sessionRoute, standingsRoute])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0, // TanStack Query owns freshness
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
