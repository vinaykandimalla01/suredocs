function stableHash(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mockDay(date, weekday) {
  const hash = stableHash(`denied:${date}`)
  const roll = (modulus, shift = 0) => (hash >>> shift) % modulus
  const active = roll(7, 5) !== 0
  const weekend = weekday === 0 || weekday === 6
  const deniedCount = active
    ? (roll(9, 9) === 0 ? 4 + roll(3, 13) : (weekend ? 1 : 1 + roll(3, 11)))
    : 0
  const users = Array.from({ length: deniedCount }, (_, index) => `user-${(index * 7 + roll(97, 17)) % 97}`)
  const documents = Array.from({ length: deniedCount }, (_, index) => `document-${(index * 11 + roll(211, 21)) % 211}`)
  const successfulAttempts = 72 + roll(71, 2) + (weekend ? -28 : 0)
  return {
    date,
    denied: deniedCount,
    userIds: users,
    documentIds: documents,
    totalAccessAttempts: successfulAttempts + deniedCount,
  }
}

export function getAdminDeniedRequestsMockData(days) {
  const today = new Date()
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const allDays = Array.from({ length: days * 2 }, (_, index) => {
    const timestamp = todayUtc - ((days * 2) - index - 1) * 24 * 60 * 60 * 1000
    const day = new Date(timestamp)
    return mockDay(day.toISOString().slice(0, 10), day.getUTCDay())
  })
  const previousDaily = allDays.slice(0, days)
  const daily = allDays.slice(days)
  const aggregate = (points) => {
    const denied = points.reduce((total, point) => total + point.denied, 0)
    const totalAccessAttempts = points.reduce((total, point) => total + point.totalAccessAttempts, 0)
    const uniqueUsers = new Set(points.flatMap((point) => point.userIds))
    const distinctDocuments = new Set(points.flatMap((point) => point.documentIds))
    return {
      denied,
      total_access_attempts: totalAccessAttempts,
      unique_users: uniqueUsers.size,
      distinct_documents: distinctDocuments.size,
      denial_percent: totalAccessAttempts ? Math.round((denied * 1000) / totalAccessAttempts) / 10 : 0,
    }
  }
  const current = aggregate(daily)
  const previous = aggregate(previousDaily)
  const change = previous.denied === 0
    ? (current.denied === 0 ? 0 : null)
    : Math.round(((current.denied - previous.denied) / previous.denied) * 1000) / 10

  return {
    period_days: days,
    daily,
    totals: current,
    comparison: { denied_change_percent: change, previous_denied: previous.denied },
  }
}
