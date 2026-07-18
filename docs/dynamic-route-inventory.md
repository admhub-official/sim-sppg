# Dynamic Action Route Inventory

Generated automatically from `app.js` at 2026-07-18T06:33:17.295Z.

## Summary

- Literal API calls found: **60**
- Routed to modular/public functions: **54**
- Still falling back to `dynamic-action`: **6**

## Remaining Dynamic Routes

| Function | Current destination |
|---|---|
| `geocodeAlamat` | `dynamic-action` fallback |
| `getFileUrl` | `dynamic-action` fallback |
| `getPushPublicKey` | `dynamic-action` fallback |
| `getUploadBuktiMode` | `dynamic-action` fallback |
| `savePushSubscription` | `dynamic-action` fallback |
| `setUploadBuktiMode` | `dynamic-action` fallback |

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
| `getAdminAssignments` | `operations` |
| `getAllUsers` | `operations` |
| `getAuditLog` | `reporting` |
| `getChartData` | `reporting` |
| `getDashboardKPI` | `reporting` |
| `getDropdownOptions` | `public` |
| `getMasterBahanBaku` | `master` |
| `getMasterSupplier` | `master` |
| `getMenuHarian` | `operations` |
| `getNotifications` | `reporting` |
| `getPendingPayments` | `operations` |
| `getSPPGData` | `reporting` |
| `getSerahTerima` | `operations` |
| `getSurveiBahanBaku` | `operations` |
| `getTransactionDetail` | `transaction` |
| `getTransactions` | `transaction` |
| `loginUser` | `public` |
| `markAllNotificationsRead` | `reporting` |
| `markNotificationRead` | `reporting` |
| `registerUser` | `public` |
| `resendRegistrationOtp` | `public` |
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
