/** Ties a module's English messages to the shape of its French ones: a missing or extra key fails typecheck. */
export function defineMessages<const Fr extends object>(fr: Fr, en: Widen<Fr>) {
  return { fr: fr as Widen<Fr>, en }
}

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> }
