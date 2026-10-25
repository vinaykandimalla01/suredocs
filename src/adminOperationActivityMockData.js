const operationTypes = [
  { key: 'read_view', label: 'Read / View' },
  { key: 'download', label: 'Download' },
  { key: 'upload', label: 'Upload' },
  { key: 'edit_replace', label: 'Edit / Replace' },
  { key: 'delete', label: 'Delete' },
  { key: 'permission_changes', label: 'Permission changes' },
]

function stableValue(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function dailyOperationCounts(date, weekday, type) {
  const seed = stableValue(`${date}:${type.key}`)
  const variation = (modulus, offset = 0) => (seed >>> offset) % modulus
  const weekdayFactor = weekday === 0 || weekday === 6 ? 0.62 : 1
  const peakFactor = variation(11, 4) === 0 ? 1.35 : 1
  const scale = (value) => Math.round(value * weekdayFactor * peakFactor)
  const ranges = {
    read_view: { success: [82, 154], denied: [1, 7] },
    download: { success: [22, 48], denied: [0, 3] },
    upload: { success: [5, 14], denied: [0, 2] },
    edit_replace: { success: [10, 25], denied: [0, 2] },
    delete: { success: [1, 5], denied: [0, 1] },
    permission_changes: { success: [28, 59], denied: [1, 5] },
  }
  const range = ranges[type.key]
  return {
    success: scale(range.success[0] + variation(range.success[1] - range.success[0] + 1)),
    denied: variation(range.denied[1] - range.denied[0] + 1, 10),
  }
}

function percentageChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export function getAdminOperationActivityMockData(days, operation) {
  const today = new Date()
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const allDays = Array.from({ length: days * 2 }, (_, index) => {
    const timestamp = todayUtc - ((days * 2) - index - 1) * 24 * 60 * 60 * 1000
    const day = new Date(timestamp)
    const date = day.toISOString().slice(0, 10)
    const byOperation = Object.fromEntries(
      operationTypes.map((type) => [type.key, dailyOperationCounts(date, day.getUTCDay(), type)]),
    )
    const matchingTypes = operation === 'all'
      ? operationTypes
      : operationTypes.filter((type) => type.key === operation)
    const totals = matchingTypes.reduce(
      (sum, type) => ({
        success: sum.success + byOperation[type.key].success,
        denied: sum.denied + byOperation[type.key].denied,
      }),
      { success: 0, denied: 0 },
    )
    return { date, byOperation, ...totals }
  })

  const previousDaily = allDays.slice(0, days)
  const daily = allDays.slice(days)
  const summarize = (points) => points.reduce(
    (sum, point) => ({ success: sum.success + point.success, denied: sum.denied + point.denied }),
    { success: 0, denied: 0 },
  )
  const totals = summarize(daily)
  const previousTotals = summarize(previousDaily)
  const by_type = (operation === 'all' ? operationTypes : operationTypes.filter((type) => type.key === operation))
    .map(({ key, label }) => {
      const counts = daily.reduce(
        (sum, point) => ({
          success: sum.success + point.byOperation[key].success,
          denied: sum.denied + point.byOperation[key].denied,
        }),
        { success: 0, denied: 0 },
      )
      return { key, label, ...counts }
    })

  return {
    period_days: days,
    operation,
    daily,
    by_type,
    totals: {
      ...totals,
      total: totals.success + totals.denied,
      success_change_percent: percentageChange(totals.success, previousTotals.success),
      denied_change_percent: percentageChange(totals.denied, previousTotals.denied),
      total_change_percent: percentageChange(totals.success + totals.denied, previousTotals.success + previousTotals.denied),
    },
  }
}
