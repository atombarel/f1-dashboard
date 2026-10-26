import { useSyncExternalStore } from 'react'
import { dictionaries, type Dictionary } from './messages'

export const LANGS = [
  { code: 'fr', label: 'FR', name: 'Français', locale: 'fr-FR' },
  { code: 'en', label: 'EN', name: 'English', locale: 'en-GB' },
] as const
export type Lang = (typeof LANGS)[number]['code']

const STORAGE_KEY = 'pitwall:lang'
const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.code === v)

/** ?lang= → saved choice → browser languages → English for everyone but French speakers. */
function detect(): Lang {
  if (typeof window === 'undefined') return 'fr'
  const fromUrl = new URLSearchParams(window.location.search).get('lang')
  if (isLang(fromUrl)) return fromUrl
  const saved = localStorage.getItem(STORAGE_KEY)
  if (isLang(saved)) return saved
  for (const l of navigator.languages ?? [navigator.language]) {
    const code = l.slice(0, 2).toLowerCase()
    if (isLang(code)) return code
  }
  return 'en'
}

let current: Lang = detect()
const listeners = new Set<() => void>()

export const getLang = () => current
/** BCP 47 tag for Intl formatters. */
export const getLocale = () => LANGS.find((l) => l.code === current)!.locale

export function setLang(lang: Lang) {
  if (lang === current) return
  current = lang
  localStorage.setItem(STORAGE_KEY, lang)
  const url = new URL(window.location.href)
  if (url.searchParams.has('lang')) {
    url.searchParams.set('lang', lang)
    history.replaceState(history.state, '', url)
  }
  syncDocument()
  listeners.forEach((l) => l())
}

/**
 * Current language for React. The app root is keyed on it, so a switch remounts the tree and every `t()` /
 * formatter call picks up the new language; components don't need to subscribe themselves.
 */
export const useLang = () =>
  useSyncExternalStore(
    (cb) => (listeners.add(cb), () => void listeners.delete(cb)),
    getLang,
    getLang,
  )

type Plural = { one: string; other: string }
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | Plural ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]
export type MessageKey = Leaves<Dictionary>

function lookup(dict: Dictionary, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict)
}

/**
 * `t('session.tabs.laps')`, `t('results.gap', { n: 3 })` fills `{n}`; plural messages ({ one, other }) pick
 * their form from `count`. Call it at render time, never at module top level (the language can change).
 */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let msg = lookup(dictionaries[current], key) as string | Plural | undefined
  if (msg && typeof msg === 'object') {
    msg = new Intl.PluralRules(getLocale()).select(Number(vars?.count ?? 0)) === 'one' ? msg.one : msg.other
  }
  if (typeof msg !== 'string') return key
  return vars ? msg.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : msg
}

function syncDocument() {
  document.documentElement.lang = current
  document.title = t('meta.title')
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'))
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', t('meta.ogTitle'))
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', t('meta.ogDescription'))
}

if (typeof document !== 'undefined') syncDocument()
