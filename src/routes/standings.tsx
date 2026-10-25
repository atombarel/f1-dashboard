import type { StandingDriver, StandingsResponse, StandingTeam } from '@shared/types'
import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { EmptyState, ErrorState, PageHeader, Panel, SectionTitle, Segmented, Skeleton, StartLights } from '@/components/ui'
import { YearSwitcher } from '@/features/home/YearSwitcher'
import { ProgressionChart, type Series } from '@/features/standings/ProgressionChart'
import { seasonQuery, standingsQuery } from '@/lib/api'
import { onDark } from '@/lib/colors'
import { points } from '@/lib/format'

type View = 'drivers' | 'teams'

export function StandingsPage() {
  const { year } = useParams({ from: '/classements/$year' })
  const q = useQuery(standingsQuery(year))
  const season = useQuery(seasonQuery(year))
  const [view, setView] = useState<View>('drivers')
  const [highlight, setHighlight] = useState<string | null>(null)
  const years = season.data?.seasons ?? [year]

  return (
    <div>
      <PageHeader
        eyebrow={<span>Championnat du monde</span>}
        title={
          <>
            Classements <span className="text-signal">{year}</span>
          </>
        }
        aside={<YearSwitcher years={years} current={year} to="/classements/$year" />}
      >
        {q.data && <span className="tnum">Après la manche {q.data.round} · source officielle Jolpica-F1</span>}
      </PageHeader>

      {q.isPending ? (
        <StartLights label="Calcul du classement" />
      ) : q.isError ? (
        q.error instanceof Error && 'status' in q.error && q.error.status === 404 ? (
          <EmptyState title="Classement indisponible">Aucun résultat officiel pour la saison {year} pour l’instant.</EmptyState>
        ) : (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        )
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between gap-4">
            <Segmented<View>
              items={[
                { value: 'drivers', label: 'Pilotes' },
                { value: 'teams', label: 'Constructeurs' },
              ]}
              value={view}
              onChange={(v) => {
                setView(v)
                setHighlight(null)
              }}
            />
            <Leader standings={q.data} view={view} />
          </div>
          <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <section className="min-w-0">
              <SectionTitle index="01" title={view === 'drivers' ? 'Pilotes' : 'Constructeurs'} />
              {view === 'drivers' ? (
                <DriverTable rows={q.data.drivers} highlight={highlight} onHighlight={setHighlight} />
              ) : (
                <TeamTable rows={q.data.teams} highlight={highlight} onHighlight={setHighlight} />
              )}
            </section>
            <section className="min-w-0 self-start xl:sticky xl:top-20">
              <SectionTitle index="02" title="Évolution" aside={<span>Points cumulés · survole une ligne</span>} />
              <Panel className="p-4 pr-2">
                <Progression standings={q.data} view={view} highlight={highlight} onHighlight={setHighlight} />
              </Panel>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function Leader({ standings, view }: { standings: StandingsResponse; view: View }) {
  const [a, b] = view === 'drivers' ? standings.drivers : standings.teams
  if (!a) return null
  const name = 'code' in a ? a.code : a.name
  const nameB = b ? ('code' in b ? b.code : b.name) : ''
  return (
    <div className="hidden text-right sm:block">
      <div className="eyebrow">Avance du leader</div>
      <div className="tnum text-sm">
        <span style={{ color: onDark(a.teamColour) }}>{name}</span> {b && <>+{points(a.points - b.points)} sur {nameB}</>}
      </div>
    </div>
  )
}

function Progression({ standings, view, highlight, onHighlight }: { standings: StandingsResponse; view: View; highlight: string | null; onHighlight: (id: string | null) => void }) {
  const series = useMemo<Series[]>(() => {
    if (view === 'teams')
      return standings.teams.map((t) => ({ id: t.teamId, label: t.name.length > 12 ? t.name.slice(0, 11) + '…' : t.name, colour: onDark(t.teamColour), dashed: false, values: standings.progression.teams[t.teamId] ?? [] }))
    const seen = new Set<string>()
    return standings.drivers.map((d) => {
      const dashed = seen.has(d.teamId)
      seen.add(d.teamId)
      return { id: d.driverId, label: d.code, colour: onDark(d.teamColour), dashed, values: standings.progression.drivers[d.driverId] ?? [] }
    })
  }, [standings, view])
  if (!standings.progression.rounds.length) return <Skeleton className="h-[420px]" />
  return <ProgressionChart series={series} rounds={standings.progression.rounds} highlight={highlight} onHighlight={onHighlight} />
}

function rowClass(active: boolean) {
  return clsx('group cursor-default border-b border-line/70 transition-colors duration-150', active && 'bg-panel-2')
}

function PointsCell({ value, max, colour }: { value: number; max: number; colour: string }) {
  return (
    <td className="py-2.5 pr-3">
      <div className="flex items-center justify-end gap-3">
        <div className="hidden h-1 w-24 bg-panel-2 md:block">
          <div className="h-full" style={{ width: `${(value / (max || 1)) * 100}%`, background: colour }} />
        </div>
        <span className="tnum w-12 text-right text-sm text-paper">{points(value)}</span>
      </div>
    </td>
  )
}

function DriverTable({ rows, highlight, onHighlight }: { rows: StandingDriver[]; highlight: string | null; onHighlight: (id: string | null) => void }) {
  const max = rows[0]?.points ?? 1
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="eyebrow border-b border-line-2 text-left">
            <th className="w-10 py-2 font-normal">Pos</th>
            <th className="py-2 font-normal">Pilote</th>
            <th className="hidden py-2 font-normal md:table-cell">Équipe</th>
            <th className="hidden py-2 text-right font-normal sm:table-cell">Vict.</th>
            <th className="py-2 pr-3 text-right font-normal">Points</th>
            <th className="hidden py-2 text-right font-normal sm:table-cell">Écart</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => {
            const c = onDark(d.teamColour)
            return (
              <tr
                key={d.driverId}
                className={rowClass(highlight === d.driverId)}
                onPointerEnter={() => onHighlight(d.driverId)}
                onPointerLeave={() => onHighlight(null)}
                style={{ animation: `rise .5s ${Math.min(i, 20) * 25}ms both` }}
              >
                <td className={clsx('tnum py-2.5 text-xs', i < 3 ? 'text-paper' : 'text-dim')}>{d.position}</td>
                <td className="py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-0.5" style={{ background: c }} />
                    <div className="relative size-8 shrink-0 overflow-hidden rounded-full border border-line bg-panel-2">
                      {d.headshot ? (
                        <img src={d.headshot} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover object-top" />
                      ) : (
                        <span className="flex size-full items-center justify-center font-mono text-[9px] text-dim">{d.number ?? ''}</span>
                      )}
                    </div>
                    <div className="min-w-0 leading-tight">
                      <div className="truncate">
                        <span className="text-muted">{d.givenName} </span>
                        <span className="font-semibold uppercase tracking-wide">{d.familyName}</span>
                      </div>
                      <div className="font-mono text-[10px] text-dim md:hidden">{d.teamName}</div>
                    </div>
                  </div>
                </td>
                <td className="hidden py-2.5 text-xs text-muted md:table-cell">{d.teamName}</td>
                <td className="tnum hidden py-2.5 text-right text-xs sm:table-cell">{d.wins || <span className="text-dim">—</span>}</td>
                <PointsCell value={d.points} max={max} colour={c} />
                <td className="tnum hidden py-2.5 text-right text-xs text-dim sm:table-cell">{i === 0 ? '—' : `−${points(max - d.points)}`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TeamTable({ rows, highlight, onHighlight }: { rows: StandingTeam[]; highlight: string | null; onHighlight: (id: string | null) => void }) {
  const max = rows[0]?.points ?? 1
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="eyebrow border-b border-line-2 text-left">
            <th className="w-10 py-2 font-normal">Pos</th>
            <th className="py-2 font-normal">Équipe</th>
            <th className="hidden py-2 text-right font-normal sm:table-cell">Vict.</th>
            <th className="py-2 pr-3 text-right font-normal">Points</th>
            <th className="hidden py-2 text-right font-normal sm:table-cell">Écart</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => {
            const c = onDark(t.teamColour)
            return (
              <tr
                key={t.teamId}
                className={rowClass(highlight === t.teamId)}
                onPointerEnter={() => onHighlight(t.teamId)}
                onPointerLeave={() => onHighlight(null)}
                style={{ animation: `rise .5s ${i * 30}ms both` }}
              >
                <td className={clsx('tnum py-3 text-xs', i < 3 ? 'text-paper' : 'text-dim')}>{t.position}</td>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <span className="h-7 w-1" style={{ background: c }} />
                    <div className="leading-tight">
                      <div className="font-semibold uppercase tracking-wide">{t.name}</div>
                      <div className="text-[11px] text-dim">{t.nationality}</div>
                    </div>
                  </div>
                </td>
                <td className="tnum hidden py-3 text-right text-xs sm:table-cell">{t.wins || <span className="text-dim">—</span>}</td>
                <PointsCell value={t.points} max={max} colour={c} />
                <td className="tnum hidden py-3 text-right text-xs text-dim sm:table-cell">{i === 0 ? '—' : `−${points(max - t.points)}`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
