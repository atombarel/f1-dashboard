import common from './common'
import pages from './pages'
import results from './results'
import sessionFeatures from './session-features'
import telemetry from './telemetry'

// One { fr, en } file per area of the app. French is the source: `en` must have the exact same shape.
const modules = [common, pages, results, sessionFeatures, telemetry] as const

type Merge<T extends readonly { fr: object }[]> = T extends readonly [infer H extends { fr: object }, ...infer R extends { fr: object }[]]
  ? H['fr'] & Merge<R>
  : unknown
export type Dictionary = Merge<typeof modules>

export const dictionaries = {
  fr: Object.assign({}, ...modules.map((m) => m.fr)) as Dictionary,
  en: Object.assign({}, ...modules.map((m) => m.en)) as Dictionary,
}
