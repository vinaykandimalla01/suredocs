import { apiGet } from './api.js'

export function getAdminDashboardSummary(options) {
  return apiGet('/api/admin/dashboard/summary', options)
}
