import { create } from 'zustand'
import { emitAuditEvent } from '@/lib/audit'

/**
 * LGPD consent state.
 *
 * Consent decisions are NOT health data — they are a lawful record of what the
 * person agreed to, so we may persist the granular flags to localStorage. No
 * health information ever lands here. Everything is opt-in by default (nothing
 * is `true` until the person actively agrees).
 */

export interface ConsentState {
  decided: boolean
  essential: true // always on — the app can't run without it
  analytics: boolean
  comunicacoes: boolean
  setConsent: (next: { analytics: boolean; comunicacoes: boolean }) => void
  acceptAll: () => void
  rejectOptional: () => void
}

const STORAGE_KEY = 'prumo.consent.v1'

interface StoredConsent {
  analytics: boolean
  comunicacoes: boolean
}

function load(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredConsent
    return {
      analytics: Boolean(parsed.analytics),
      comunicacoes: Boolean(parsed.comunicacoes),
    }
  } catch {
    return null
  }
}

function persist(value: StoredConsent): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* storage disabled — consent simply won't survive a reload; that's fine */
  }
}

const stored = load()

export const useConsent = create<ConsentState>((set) => ({
  decided: stored !== null,
  essential: true,
  analytics: stored?.analytics ?? false,
  comunicacoes: stored?.comunicacoes ?? false,

  setConsent: ({ analytics, comunicacoes }) => {
    persist({ analytics, comunicacoes })
    emitAuditEvent('consent.updated', { analytics, comunicacoes })
    set({ decided: true, analytics, comunicacoes })
  },

  acceptAll: () => {
    persist({ analytics: true, comunicacoes: true })
    emitAuditEvent('consent.updated', { analytics: true, comunicacoes: true, choice: 'all' })
    set({ decided: true, analytics: true, comunicacoes: true })
  },

  rejectOptional: () => {
    persist({ analytics: false, comunicacoes: false })
    emitAuditEvent('consent.updated', { analytics: false, comunicacoes: false, choice: 'essential' })
    set({ decided: true, analytics: false, comunicacoes: false })
  },
}))
