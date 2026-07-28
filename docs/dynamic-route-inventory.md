# Dynamic Action Route Inventory

Generated automatically from `app.js` at 2026-07-28T04:42:04.583Z.

## Summary

- Literal API calls found: **70**
- Functions declared in `API_ROUTES`: **83**
- Routed literal API calls: **70**
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
| `addTransaction` | `transaction-action` |
| `approveTransaction` | `approval-payment-action` |
| `approveTransactionsBulk` | `approval-payment-action` |
| `createAnnouncement` | `settings-action` |
| `deleteAdminAssignment` | `operations-action` |
| `deleteMasterBahanBaku` | `master-action` |
| `deleteMenuMBG` | `operations-action` |
| `deletePendingPayment` | `operations-action` |
| `deleteSerahTerima` | `operations-action` |
| `deleteSupplier` | `master-action` |
| `deleteSurvei` | `operations-action` |
| `deleteTransaction` | `transaction-action` |
| `deleteUser` | `operations-action` |
| `editTransaction` | `transaction-action` |
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
| `getTransactions` | `approval-payment-action` |
| `getUploadBuktiMode` | `operations-action` |
| `loginUser` | `auth-public-action` |
| `markAllNotificationsRead` | `reporting-action` |
| `markNotificationRead` | `reporting-action` |
| `registerUser` | `register-user-v2` |
| `resendRegistrationOtp` | `auth-public-action` |
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
| `uploadTxFile` | `transaction-action` |
| `verifyRegistrationOtp` | `auth-public-action` |
| `verifyUserPayment` | `approval-payment-action` |

## Declared but Not Called Literally

| Function | Route group |
|---|---|
| `checkSession` | `auth-public-action` |
| `deletePushSubscription` | `push-action` |
| `dispatchNotification` | `notification-dispatch-action` |
| `getAppConfig` | `app-config-action` |
| `getFilterOptions` | `reporting-action` |
| `getRekapHarian` | `reporting-action` |
| `recoverPassword` | `account-recovery-action` |
| `recoverToken` | `account-recovery-action` |
| `recoverUsername` | `account-recovery-action` |
| `sendCatatanApproval` | `transaction-action` |
| `showCredentials` | `file-access-action` |
| `uploadSerahTerimaFile` | `master-action` |
| `uploadSupplierFile` | `master-action` |

## Guardrail

Any new literal `callApi('...')` invocation that is not included in `API_ROUTES` will appear in the remaining routes table and must fail CI.
