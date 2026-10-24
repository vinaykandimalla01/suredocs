// Visual-only security signals for controls not yet backed by a monitoring API.
export const demoSecurityMetrics = [
  { id: 'suspicious', label: 'Suspicious Activities', value: 12, change: '40% from last week', color: 'red', icon: 'shield', values: [1, 1, 2, 4, 3, 5, 7, 6, 9] },
  { id: 'failed', label: 'Failed Login Attempts', value: 28, change: '12% from last week', color: 'orange', icon: 'warning', values: [2, 3, 2, 4, 6, 5, 7, 8, 7] },
  { id: 'locations', label: 'Unusual Access Locations', value: 5, change: '67% from last week', color: 'blue', icon: 'users', values: [1, 1, 2, 1, 3, 3, 4, 3, 5] },
  { id: 'devices', label: 'Unrecognized Devices', value: 3, change: '50% from last week', color: 'purple', icon: 'device', values: [0, 1, 1, 1, 2, 1, 2, 3, 3] },
]

export const demoRiskDistribution = [
  { name: 'Failed Login Attempts', value: 28, color: '#ff424b' },
  { name: 'Suspicious Activities', value: 12, color: '#ffa51f' },
  { name: 'Unusual Locations', value: 5, color: '#2878ff' },
  { name: 'Unrecognized Devices', value: 3, color: '#8b35f5' },
]

export const demoTrendSeries = [
  { key: 'suspicious', name: 'Suspicious Activities', color: '#ff424b', values: [21, 38, 22, 44, 68, 34, 38, 27, 34] },
  { key: 'failed', name: 'Failed Logins', color: '#ffa51f', values: [8, 12, 8, 24, 20, 42, 23, 29, 25] },
  { key: 'locations', name: 'Unusual Locations', color: '#2878ff', values: [3, 5, 4, 10, 12, 8, 12, 17, 11] },
  { key: 'devices', name: 'Unrecognized Devices', color: '#8b35f5', values: [5, 4, 5, 8, 12, 10, 6, 9, 8] },
]

export const demoInsights = [
  { color: 'red', text: 'Failed login attempts increased by 40% compared to last week.' },
  { color: 'blue', text: '3 users accessed from new locations.' },
  { color: 'orange', text: '2 accounts show unusual download activity.' },
  { color: 'purple', text: '1 unrecognized device was detected.' },
]

export const demoRiskyUsers = [
  { initials: 'AR', name: 'Ananya Reddy', email: 'ananya.reddy@example.invalid', score: 92, events: 18, color: 'violet', values: [2, 4, 3, 6, 5, 8, 7, 10] },
  { initials: 'RS', name: 'Rahul Sharma', email: 'rahul.sharma@example.invalid', score: 76, events: 12, color: 'purple', values: [2, 3, 2, 4, 3, 6, 5, 7] },
  { initials: 'KM', name: 'Karan Mehta', email: 'karan.mehta@example.invalid', score: 64, events: 9, color: 'orange', values: [1, 2, 1, 3, 3, 4, 3, 5] },
  { initials: 'PN', name: 'Priya Nair', email: 'priya.nair@example.invalid', score: 48, events: 7, color: 'blue', values: [1, 2, 2, 3, 2, 4, 3, 5] },
  { initials: 'VS', name: 'Vikram Singh', email: 'vikram.singh@example.invalid', score: 45, events: 6, color: 'blue', values: [1, 3, 2, 2, 3, 2, 3, 2] },
]

export const demoWorkflowStatuses = ['Open', 'Investigating', 'Resolved']
