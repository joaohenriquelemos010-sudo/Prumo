/**
 * Audit trail (conceptual).
 *
 * Every sensitive action in Prumo emits a typed event. Today these events only
 * reach the console in development, but the shape is deliberately backend-ready:
 * a clinical platform needs an immutable, queryable record of who did what and
 * when. When the API layer lands, `emitAuditEvent` is the single seam to wire
 * into a real, append-only audit log — nothing else in the app needs to change.
 *
 * We never put patient-identifying data in an event payload here: only stable,
 * non-sensitive identifiers and the action name.
 */

export type AuditAction =
  | 'onboarding.started'
  | 'onboarding.role_selected'
  | 'onboarding.completed'
  | 'trilha.node_opened'
  | 'trilha.node_completed'
  | 'consent.updated'
  | 'privacy.data_export_requested'
  | 'privacy.account_deletion_requested'
  | 'form.submitted'
  | 'form.rejected'

export interface AuditEvent {
  action: AuditAction
  /** Non-sensitive metadata only — never names, CPF, health data. */
  meta?: Record<string, string | number | boolean>
  at: string
}

type AuditSink = (event: AuditEvent) => void

let sink: AuditSink = (event) => {
  if (import.meta.env.DEV) {
    console.info('[audit]', event.action, event.meta ?? {})
  }
}

/** Swap the sink for the real backend transport once it exists. */
export function setAuditSink(next: AuditSink): void {
  sink = next
}

export function emitAuditEvent(
  action: AuditAction,
  meta?: AuditEvent['meta'],
): void {
  sink({ action, meta, at: new Date().toISOString() })
}
