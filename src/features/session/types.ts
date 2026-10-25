import type { Driver, SessionBundle, SessionMeta } from '@shared/types'

/** Props every session tab receives. Selection is shared across tabs and kept in the URL (?d=1,16). */
export interface TabProps {
  meta: SessionMeta
  bundle: SessionBundle
  drivers: Map<number, Driver>
  /** drivers in classification order */
  ordered: Driver[]
  selected: number[]
  setSelected: (next: number[]) => void
}
