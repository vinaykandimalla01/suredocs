import { apiGet } from './api.js'

export function getAdminDashboardSummary(days, options) {
  return apiGet(`/api/admin/dashboard/summary?days=${days}`, options)
}

export function getAdminDashboardStorage(days, options) {
  return apiGet(`/api/admin/dashboard/storage?days=${days}`, options)
}

export function getAdminDeniedRequests(days, options) {
  return apiGet(`/api/admin/dashboard/denied-requests?days=${days}`, options)
}

export function getAdminOperations(days, operation, options) {
  const query = new URLSearchParams({ days: String(days), operation })
  return apiGet(`/api/admin/dashboard/operations?${query}`, options)
}
