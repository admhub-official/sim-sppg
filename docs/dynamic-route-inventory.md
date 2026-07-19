# Dynamic Action Route Inventory

Generated automatically from `app.js` at 2026-07-19T17:43:30.207Z.

## Summary

- Literal API calls found: **60**
- Functions declared in `API_ROUTES`: **73**
- Routed literal API calls: **60**
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
| `approveTransaction` | `transaction-action` |
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
| `getNotifications` | `reporting-action` |
| `getPendingPayments` | `operations-action` |
| `getPushPublicKey` | `push-public-action` |
| `getSPPGData` | `reporting-action` |
| `getSerahTerima` | `operations-action` |
| `getSurveiBahanBaku` | `operations-action` |
| `getTransactionDetail` | `transaction-action` |
| `getTransactions` | `transaction-action` |
| `getUploadBuktiMode` | `operations-action` |
| `loginUser` | `auth-public-action` |
| `markAllNotificationsRead` | `reporting-action` |
| `markNotificationRead` | `reporting-action` |
| `registerUser` | `register-user-v2` |
| `resendRegistrationOtp` | `auth-public-action` |
| `savePushSubscription` | `push-action` |
| `setUploadBuktiMode` | `operations-action` |
| `submitUserBuktiPembayaran` | `transaction-action` |
| `updateAdminAssignment` | `operations-action` |
| `updateMasterBahanBaku` | `master-action` |
| `updateMasterSupplier` | `master-action` |
| `updateMenuMBG` | `operations-action` |
| `updatePendingPayment` | `operations-action` |
| `updateSerahTerima` | `operations-action` |
| `updateSurvei` | `operations-action` |
| `updateUserProfile` | `secure-user-action` |
| `uploadFotoProfil` | `secure-user-action` |
| `uploadFotoSurvei` | `master-action` |
| `uploadTxFile` | `transaction-action` |
| `verifyRegistrationOtp` | `auth-public-action` |
| `verifyUserPayment` | `transaction-action` |

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
