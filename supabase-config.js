/* SIM-SPPG Supabase browser client
 * Safe for public frontend use: publishable key only.
 * Never place service_role/secret keys in this repository.
 */
(function (window, document) {
  'use strict';

  var SUPABASE_URL = 'https://dmjsgtichrfxhyywstrt.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_PqO81PlEN24os7R9OBEeaw_IOi_Dmws';

  window.SIM_SPPG_SUPABASE = Object.freeze({
    url: SUPABASE_URL,
    publishableKey