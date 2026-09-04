# Dynamic Action Route Inventory

Generated automatically from `app.js` at 2026-09-04T22:46:11.612Z.

## Summary

- Literal API calls found: **71**
- Functions declared in `API_ROUTES`: **99**
- Routed literal API calls: **71**
- Unmapped literal API calls: **0**
- Legacy `dynamic-action` fallback: **0**

## Remaining Dynamic Routes

| Function | Current destination |
|---|---|
| — | — |

## Routed Functions

| Function | Route group |
|---|---|
| `addAdminAssignment` | `operations-action` |
| `addMasterBahanBaku` | `master-action` |
| `addMasterSupplier` | `master-action` |
| `addMenuHarian` | `operations-action` |
| `addPendingPayment` | `operations-action` |
| `addSerahTerima` | `operations-action` |
| `addSurveiBahanBaku` | `operations-action` |
| `addTransaction` | `transaction-create-action` |
| `approveTransaction` | `approval-payment-action` |
| `approveTransactionsBulk` | `approval-payment-action` |
| `createAnnouncement` | `settings-action` |
| `createUserBySuperAdmin` | `register-user-v2` |
| `deleteAdminAssignment` | `operations-action` |
| `deleteMasterBahanBaku` | `master-action` |
| `deleteMenuMBG` | `operations-action` |
| `deletePendingPayment` | `operations-action` |
| `deleteSerahTerima` | `operations-action` |
| `deleteSupplier` | `supplier-delete-action` |
| `deleteSurvei` | `operations-action` |
| `deleteTransaction` | `transaction-action` |
| `deleteUser` | `operations-action` |
| `editTransaction` | `transaction-edit-action` |
| `geocodeAlamat` | `geocode-action` |
| `getAdminAssignments` | `operations-action` |
| `getAllUsers` | `operations-action` |
| `getAuditLog` | `reporting-action` |
| `getChartData` | `reporting-action` |
| `getDashboardKPI` | `reporting-action` |
| `getDropdownOptions` | `app-config-action` |
| `getFileUrl` | `file-access-action` |
| `getMasterBahanBaku` | `master-action` |
| `getMasterSupplier` | `master-action` |
| `getMenuHarian` | `operations-action` |
| `getMyAnnouncements` | `settings-action` |
| `getMyMenuVisibility` | `settings-action` |
| `getNotifications` | `reporting-action` |
| `getPendingPayments` | `operations-action` |
| `getPushPublicKey` | `push-public-action` |
| `getSPPGData` | `reporting-action` |
| `getSerahTerima` | `operations-action` |
| `getSettingsHub` | `settings-action` |
| `getSurveiBahanBaku` | `operations-action` |
| `getTransactionDetail` | `approval-payment-action` |
| `getTransactionEditMode` | `operations-action` |
| `getTransactionSuggestions` | `transaction-action` |
| `getTransactionSummary` | `transaction-summary-action` |
| `getTransactions` | `approval-payment-action` |
| `getUploadBuktiMode` | `operations-action` |
| `loginUser` | `auth-public-action` |
| `logoutSession` | `auth-public-action` |
| `markAllNotificationsRead` | `reporting-action` |
| `markNotificationRead` | `reporting-action` |
| `savePushSubscription` | `push-action` |
| `setAnnouncementActive` | `settings-action` |
| `submitUserBuktiPembayaran` | `approval-payment-action` |
| `submitUserBulkBuktiPembayaran` | `approval-payment-action` |
| `updateAdminAssignment` | `operations-action` |
| `updateFeatureSettings` | `settings-action` |
| `updateMasterBahanBaku` | `master-action` |
| `updateMasterSupplier` | `master-action` |
| `updateMenuMBG` | `operations-action` |
| `updateMenuVisibility` | `settings-action` |
| `updatePendingPayment` | `operations-action` |
| `updatePresence` | `operations-action` |
| `updateSerahTerima` | `operations-action` |
| `updateSurvei` | `operations-action` |
| `updateUserProfile` | `secure-user-action` |
| `uploadFotoProfil` | `secure-user-action` |
| `uploadFotoSurvei` | `master-action` |
| `uploadTxFile` | `transaction-file-upload-action` |
| `verifyUserPayment` | `approval-payment-action` |

## Declared but Not Called Literally

| Function | Route group |
|---|---|
| `checkSession` | `auth-public-action` |
| `confirmChatTrx` | `chattrx-confirm-action` |
| `createDocumentFolder` | `document-action` |
| `createTextDocument` | `document-action` |
| `deleteMyTrx` | `chattrx-records-action` |
| `deletePushSubscription` | `push-action` |
| `dispatchNotification` | `notification-dispatch-action` |
| `getAppConfig` | `app-config-action` |
| `getChatTrxSuggestions` | `chattrx-suggest-action` |
| `getDocumentUrl` | `document-action` |
| `getFilterOptions` | `reporting-action` |
| `getRekapHarian` | `reporting-action` |
| `listDocuments` | `document-action` |
| `listMyTrx` | `chattrx-records-action` |
| `moveDocumentFile` | `document-action` |
| `recoverPassword` | `account-recovery-action` |
| `refreshSession` | `auth-public-action` |
| `renameDocumentItem` | `document-action` |
| `restoreDocumentItem` | `document-action` |
| `sendCatatanApproval` | `transaction-action` |
| `sendChatTrxMessage` | `chattrx-message-action` |
| `showCredentials` | `file-access-action` |
| `toggleDocumentFavorite` | `document-action` |
| `trashDocumentItem` | `document-action` |
| `updateMyTrx` | `chattrx-records-action` |
| `uploadDocument` | `document-action` |
| `uploadSerahTerimaFile` | `master-action` |
| `uploadSupplierFile` | `master-action` |

## Guardrail

Any new literal `callApi('...')` invocation that is not included in `API_ROUTES` will appear in the remaining routes table and must fail CI.
