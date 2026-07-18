# Dynamic Action Route Inventory

Generated automatically from `app.js` at 2026-07-18T06:08:15.567Z.

## Summary

- Literal API calls found: **60**
- Routed to modular/public functions: **44**
- Still falling back to `dynamic-action`: **16**

## Remaining Dynamic Routes

| Function | Current destination |
|---|---|
| `addAdminAssignment` | `dynamic-action` fallback |
| `addMenuHarian` | `dynamic-action` fallback |
| `addPendingPayment` | `dynamic-action` fallback |
| `addSerahTerima` | `dynamic-action` fallback |
| `addSurveiBahanBaku` | `dynamic-action` fallback |
| `deleteAdminAssignment` | `dynamic-action` fallback |
| `geocodeAlamat` | `dynamic-action` fallback |
| `getAdminAssignments` | `dynamic-action` fallback |
| `getFileUrl` | `dynamic-action` fallback |
| `getPushPublicKey` | `dynamic-action` fallback |
| `getUploadBuktiMode` | `dynamic-action` fallback |
| `markAllNotificationsRead` | `dynamic-action` fallback |
| `markNotificationRead` | `dynamic-action` fallback |
| `savePushSubscription` | `dynamic-action` fallback |
| `setUploadBuktiMode` | `dynamic-action` fallback |
| `updateAdminAssignment` | `dynamic-action` fallback |

## Routed Functions

| Function | Route group |
|---|---|
| `addMasterBahanBaku` | `master` |
| `addMasterSupplier` | `master` |
| `addTransaction` | `transaction` |
| `approveTransaction` | `transaction` |
| `deleteMasterBahanBaku` | `master` |
| `deleteMenuMBG` | `operations` |
| `deletePendingPayment` | `operations` |
| `deleteSerahTerima` | `operations` |
| `deleteSupplier` | `master` |
| `deleteSurvei` | `operations` |
| `deleteTransaction` | `transaction` |
| `deleteUser` | `operations` |
| `editTransaction` | `transaction` |
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
| `registerUser` | `public` |
| `resendRegistrationOtp` | `public` |
| `submitUserBuktiPembayaran` | `transaction` |
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
