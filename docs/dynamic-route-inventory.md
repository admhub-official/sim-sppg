# Dynamic Action Route Inventory

Generated automatically from `app.js` at 2026-07-19T15:34:06.966Z.

## Summary

- Literal API calls found: **60**
- Routed to modular/public functions: **9**
- Still falling back to `dynamic-action`: **51**

## Remaining Dynamic Routes

| Function | Current destination |
|---|---|
| `addAdminAssignment` | `dynamic-action` fallback |
| `addMasterBahanBaku` | `dynamic-action` fallback |
| `addMasterSupplier` | `dynamic-action` fallback |
| `addMenuHarian` | `dynamic-action` fallback |
| `addPendingPayment` | `dynamic-action` fallback |
| `addSerahTerima` | `dynamic-action` fallback |
| `addSurveiBahanBaku` | `dynamic-action` fallback |
| `addTransaction` | `dynamic-action` fallback |
| `approveTransaction` | `dynamic-action` fallback |
| `deleteAdminAssignment` | `dynamic-action` fallback |
| `deleteMasterBahanBaku` | `dynamic-action` fallback |
| `deleteMenuMBG` | `dynamic-action` fallback |
| `deletePendingPayment` | `dynamic-action` fallback |
| `deleteSerahTerima` | `dynamic-action` fallback |
| `deleteSupplier` | `dynamic-action` fallback |
| `deleteSurvei` | `dynamic-action` fallback |
| `deleteTransaction` | `dynamic-action` fallback |
| `deleteUser` | `dynamic-action` fallback |
| `editTransaction` | `dynamic-action` fallback |
| `getAdminAssignments` | `dynamic-action` fallback |
| `getAllUsers` | `dynamic-action` fallback |
| `getAuditLog` | `dynamic-action` fallback |
| `getChartData` | `dynamic-action` fallback |
| `getDashboardKPI` | `dynamic-action` fallback |
| `getFileUrl` | `dynamic-action` fallback |
| `getMasterBahanBaku` | `dynamic-action` fallback |
| `getMasterSupplier` | `dynamic-action` fallback |
| `getMenuHarian` | `dynamic-action` fallback |
| `getNotifications` | `dynamic-action` fallback |
| `getPendingPayments` | `dynamic-action` fallback |
| `getSPPGData` | `dynamic-action` fallback |
| `getSerahTerima` | `dynamic-action` fallback |
| `getSurveiBahanBaku` | `dynamic-action` fallback |
| `getTransactionDetail` | `dynamic-action` fallback |
| `getTransactions` | `dynamic-action` fallback |
| `getUploadBuktiMode` | `dynamic-action` fallback |
| `markAllNotificationsRead` | `dynamic-action` fallback |
| `markNotificationRead` | `dynamic-action` fallback |
| `savePushSubscription` | `dynamic-action` fallback |
| `setUploadBuktiMode` | `dynamic-action` fallback |
| `submitUserBuktiPembayaran` | `dynamic-action` fallback |
| `updateAdminAssignment` | `dynamic-action` fallback |
| `updateMasterBahanBaku` | `dynamic-action` fallback |
| `updateMasterSupplier` | `dynamic-action` fallback |
| `updateMenuMBG` | `dynamic-action` fallback |
| `updatePendingPayment` | `dynamic-action` fallback |
| `updateSerahTerima` | `dynamic-action` fallback |
| `updateSurvei` | `dynamic-action` fallback |
| `uploadFotoSurvei` | `dynamic-action` fallback |
| `uploadTxFile` | `dynamic-action` fallback |
| `verifyUserPayment` | `dynamic-action` fallback |

## Routed Functions

| Function | Route group |
|---|---|
| `geocodeAlamat` | `geocodeRuntime` |
| `getDropdownOptions` | `public` |
| `getPushPublicKey` | `public` |
| `loginUser` | `public` |
| `registerUser` | `public` |
| `resendRegistrationOtp` | `public` |
| `updateUserProfile` | `secureUser` |
| `uploadFotoProfil` | `secureUser` |
| `verifyRegistrationOtp` | `public` |

## Guardrail

Any new literal `callApi('...')` invocation that is not included in a modular route map will appear in the remaining dynamic routes table on the next run.
