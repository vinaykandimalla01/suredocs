// All values in this module are illustrative dashboard demo data.
// Live user and document counts are fetched separately through dashboardApi.js.
const storageBreakdown = [
  { label: 'PDF', value: 48, color: '#138c99' },
  { label: 'Office', value: 32, color: '#48c0c2' },
  { label: 'Images', value: 12, color: '#8bd9d1' },
  { label: 'Other', value: 8, color: '#cbd5e1' },
]

const operationTypes = [
  { key: 'read', label: 'Read / View', success: 12340, denied: 620 },
  { key: 'download', label: 'Download', success: 8210, denied: 1040 },
  { key: 'upload', label: 'Upload', success: 3850, denied: 310 },
  { key: 'edit', label: 'Edit / Replace', success: 2640, denied: 680 },
  { key: 'delete', label: 'Delete', success: 960, denied: 410 },
  { key: 'permissions', label: 'Permission changes', success: 430, denied: 1150 },
]

function normalizedSeries(values, target) {
  const sourceTotal = values.reduce((total, value) => total + value, 0)
  const result = values.map((value) => Math.round((value / sourceTotal) * target))
  result[result.length - 1] += target - result.reduce((total, value) => total + value, 0)
  return result
}

const dayLabels = Array.from({ length: 30 }, (_, index) => {
  return `Jun ${index + 1}`
})

const successShape = [760, 850, 960, 1000, 990, 1040, 1120, 1060, 990, 960, 920, 870, 840, 890, 950, 1070, 1100, 1020, 1070, 1030, 980, 920, 1170, 1090, 1140, 1200, 1110, 1020, 1140, 1260]
const deniedShape = [190, 180, 230, 200, 230, 210, 270, 200, 230, 190, 175, 210, 140, 120, 185, 310, 210, 240, 220, 200, 190, 170, 150, 250, 280, 300, 260, 220, 200, 320]
const successful = normalizedSeries(successShape, 28430)
const denied = normalizedSeries(deniedShape, 4210)
successful[29] += successful[15] - 1020
successful[15] = 1020
denied[29] += denied[15] - 230
denied[15] = 230

const operationsByType = Object.fromEntries(
  operationTypes.map((type) => [
    type.key,
    {
      success: normalizedSeries(successful, type.success),
      denied: normalizedSeries(denied, type.denied),
    },
  ]),
)

const operationSeries = dayLabels.map((label, index) => ({
  label,
  success: successful[index],
  denied: denied[index],
}))

const auditLogs = [
  {
    id: 'demo-1', date: 'Oct 22, 2026', time: '10:42 AM', initials: 'VK',
    actor: 'vinay.k@example.test', role: 'Employee', action: 'Downloaded',
    resource: 'Employee Salary Letter.pdf', target: '—', result: 'Success', ip: '192.0.2.24',
  },
  {
    id: 'demo-2', date: 'Oct 22, 2026', time: '10:35 AM', initials: 'AS',
    actor: 'admin@example.test', role: 'Admin', action: 'Granted Access',
    resource: 'Project Plan.pdf', target: 'john.d@example.test', result: 'Success', ip: '203.0.113.10',
  },
  {
    id: 'demo-3', date: 'Oct 22, 2026', time: '10:21 AM', initials: 'JD',
    actor: 'john.d@example.test', role: 'Employee', action: 'Viewed',
    resource: 'Design Document.pdf', target: '—', result: 'Success', ip: '198.51.100.7',
  },
  {
    id: 'demo-4', date: 'Oct 22, 2026', time: '09:58 AM', initials: 'SP',
    actor: 'sneha.p@example.test', role: 'Employee', action: 'Access Denied',
    resource: 'Confidential Contract.pdf', target: '—', result: 'Denied', ip: '192.0.2.45',
  },
  {
    id: 'demo-5', date: 'Oct 22, 2026', time: '09:30 AM', initials: 'AS',
    actor: 'admin@example.test', role: 'Admin', action: 'Created User',
    resource: '—', target: 'priya.m@example.test', result: 'Success', ip: '203.0.113.10',
  },
  {
    id: 'demo-6', date: 'Oct 22, 2026', time: '09:12 AM', initials: 'VK',
    actor: 'vinay.k@example.test', role: 'Employee', action: 'Uploaded',
    resource: 'Quarterly Report.xlsx', target: '—', result: 'Success', ip: '192.0.2.24',
  },
  {
    id: 'demo-7', date: 'Oct 21, 2026', time: '04:16 PM', initials: 'MC',
    actor: 'maya.c@example.test', role: 'Employee', action: 'Downloaded',
    resource: 'Policy Handbook.pdf', target: '—', result: 'Success', ip: '198.51.100.14',
  },
  {
    id: 'demo-8', date: 'Oct 21, 2026', time: '03:48 PM', initials: 'AS',
    actor: 'admin@example.test', role: 'Admin', action: 'Granted Access',
    resource: 'Budget Forecast.xlsx', target: 'maya.c@example.test', result: 'Success', ip: '203.0.113.10',
  },
]

export const dashboardMockData = {
  metricTrends: {
    users: { change: '+12%', points: [5, 7, 6, 9, 10, 11, 14, 17, 18, 23] },
    active: { change: '+8%', points: [4, 5, 6, 8, 7, 11, 14, 15, 20, 24] },
    disabled: { change: '+2%', points: [4, 5, 6, 8, 10, 11, 15, 17, 19, 23] },
    documents: { change: '+18%', points: [3, 4, 6, 5, 9, 11, 13, 16, 18, 24] },
  },
  storage: {
    total: '23 GB', addedThisMonth: '3.2 GB',
    ranges: { '7': '+6%', '30': '+25%', '90': '+48%' },
    breakdown: storageBreakdown,
  },
  deniedRequests: {
    change: '+40%',
    ranges: {
      '7': { total: 6, uniqueUsers: 5, documents: 2, requestShare: '2.1%', bars: [1, 1, 1, 0, 1, 1, 1] },
      '30': { total: 17, uniqueUsers: 14, documents: 3, requestShare: '2.4%', bars: [0, 6, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0] },
      '90': { total: 43, uniqueUsers: 31, documents: 11, requestShare: '2.8%', bars: [1, 1, 2, 1, 2, 1, 1, 2, 2, 1, 2, 1, 3, 2, 3, 2, 4, 3, 4, 2] },
    },
  },
  operationTypes,
  operationSeries,
  operationsByType,
  auditLogs,
  platformHealth: [
    {
      title: 'Audit event processing',
      description: 'Demo status for audit event processing.',
      checked: 'Last checked 11:43 AM · example display',
      detail: 'This sample status is illustrative. No live audit service check has run.',
      icon: 'shield',
    },
    {
      title: 'Document storage service',
      description: 'Demo status for S3 connectivity and document operations.',
      checked: 'Last checked 11:43 AM · example display',
      detail: 'This sample status is illustrative. No S3 or storage health check has run.',
      icon: 'storage',
    },
  ],
}
