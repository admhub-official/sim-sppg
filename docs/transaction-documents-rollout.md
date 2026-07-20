# Transaction Documents Rollout

The normalized table `TRANSAKSI_DOCUMENTS` is already present in production. Legacy transaction document columns remain temporarily for compatibility and rollback.

Phase 1 changes `transaction-action` reads to use `TRANSAKSI_DOCUMENTS`, while add and edit continue through the compatibility columns. Validate list, detail, add, edit, delete, signed URLs, Storage cleanup, and role access before moving writes fully to the normalized table.

## Review note

The existing delete flow removes Storage objects before deleting the transaction row. This behavior predates the normalized document refactor and remains a known risk: a database delete failure could leave a transaction row whose files were already removed. Do not change this inside the phase-1 rollout; address it in a dedicated follow-up using a safer deferred-cleanup or retryable deletion design.

Do not remove compatibility triggers or legacy columns until `transaction-action`, `approval-payment-action`, and reporting no longer reference them.
