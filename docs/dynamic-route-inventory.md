# Dynamic Action Route Inventory

Generated automatically from `app.js` at 2026-07-18T06:59:33.404Z.

## Summary

- Literal API calls found: **60**
- Routed to modular/public functions: **60**
- Still falling back to `dynamic-action`: **0**

## Remaining Dynamic Routes

| Function | Current destination |
|---|---|
| — | — |

## Routed Functions

| Function | Route group |
|---|---|
| `addAdminAssignment` | `operations` |
| `addMasterBahanBaku` | `master` |
| `addMasterSupplier` | `master` |
| `addMenuHarian` | `operations` |
| `addPendingPayment` | `operations` |
| `addSerahTerima` | `operations` |
| `addSurveiBahanBaku` | `operations` |
| `addTransaction` | `transaction` |
| `approveTransaction` | `transaction` |
| `deleteAdminAssignment` | `operations` |
| `deleteMasterBahanBaku` | `master` |
| `deleteMenuMBG` | `operations` |
| `deletePendingPayment` | `operations` |
| `deleteSerahTerima` | `operations` |
| `deleteSupplier` | `master` |
| `deleteSurvei` | `operations` |
| `deleteTransaction` | `transaction` |
| `deleteUser` | `operations` |
| `editTransaction` | `transaction` |
| `geocodeAlamat` | `geocodeRuntime` |
| `getAdminAssignments` | `operations` |
| `getAllUsers` | `operations` |
| `getAuditLog` | `reporting` |
| `getChartData` | `reporting` |
| `getDashboardKPI` | `reporting` |
| `getDropdownOptions` | `public` |
| `getFileUrl` | `fileAccess` |
| `getMasterBahanBaku` | `master` |
| `getMasterSupplier` | `master` |
| `getMenuHarian` | `operations` |
| `getNotifications` | `reporting` |
| `getPendingPayments` | `operations` |
| `getPushPublicKey` | `public` |
| `getSPPGData` | `reporting` |
| `getSerahTerima` | `operations` |
| `getSurveiBahanBaku` | `operations` |
| `getTransactionDetail` | `transaction` |
| `getTransactions` | `transaction` |
| `getUploadBuktiMode` | `operations` |
| `loginUser` | `public` |
| `markAllNotificationsRead` | `reporting` |
| `markNotificationRead` | `reporting` |
| `registerUser` | `public` |
| `resendRegistrationOtp` | `public` |
| `savePushSubscription` | `push` |
| `setUploadBuktiMode` | `operations` |
| `submitUserBuktiPembayaran` | `transaction` |
| `updateAdminAssignment` | `operations` |
| `updateMasterBahanBaku` | `master` |
| `updateMasterSupplier` | `master` |
| `updateMenuMBG` | `operations` |
| `updatePendingPayment` | `operations` |
| `updateSerahTerima` | `operations` |
| `updateSurvei` | `operations` |
| `updateUserProfile` | `secureUser` |
| `uploadFotoProfil` | `secureUser` |
| `uploadFotoSurvei` | `master` |
| `uploadTxFile` | `transaction` |
| `verifyRegistrationOtp` | `public` |
| `verifyUserPayment` | `transaction` |

## Guardrail

Any new literal `callApi('...')` invocation that is not included in a modular route map will appear in the remaining dynamic routes table on the next run.
