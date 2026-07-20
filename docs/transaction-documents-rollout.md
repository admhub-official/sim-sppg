# Transaction Documents Rollout

The normalized table TRANSAKSI_DOCUMENTS is already present in production. Legacy transaction document columns remain temporarily for compatibility and rollback.

Phase 1 changes transaction-action reads to use TRANSAKSI_DOCUMENTS while add and edit continue through the compatibility columns. Validate list, detail, add, edit, delete, signed URLs, Storage cleanup, and role access before moving writes fully to the normalized table.

Do not remove compatibility triggers or legacy columns until transaction-action, approval-payment-action, and reporting no longer reference them.