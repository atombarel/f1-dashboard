import { describe, expect, it } from 'vitest'
import common from '../src/i18n/messages/common'
import pages from '../src/i18n/messages/pages'
import results from '../src/i18n/messages/results'
import sessionFeatures from '../src/i18n/messages/session-features'
import telemetry from '../src/i18n/messages/telemetry'
import { dictionaries } from '../src/i18n/messages'

const modules = { common, pages, results, sessionFeatures, telemetry }

/** "a.b.c" → message, plural forms flattened as "a.b.c#one". */
function flatten(node: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out.set(key, v)
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv)
  }
  return out
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('i18n messages', () => {
  it('registers every module and no two modules share a namespace', () => {
    const seen = new Map<string, string>()
    for (const [name, m] of Object.entries(modules)) {
      for (const ns of Object.keys(m.fr)) {
        expect(seen.get(ns), `namespace "${ns}" defined in ${seen.get(ns)} and ${name}`).toBeUndefined()
        seen.set(ns, name)
      }
    }
    expect(Object.keys(dictionaries.fr).sort()).toEqual([...seen.keys()].sort())
  })

  const fr = flatten(dictionaries.fr)
  const en = flatten(dictionaries.en)

  it('has the same keys in both languages', () => {
    expect([...en.keys()].sort()).toEqual([...fr.keys()].sort())
  })

  it('uses the same {placeholders} in both languages and no empty messages', () => {
    for (const [key, frMsg] of fr) {
      const enMsg = en.get(key)!
      expect(placeholders(enMsg), key).toEqual(placeholders(frMsg))
      if (frMsg.trim()) expect(enMsg.trim(), key).not.toBe('')
    }
  })
})
