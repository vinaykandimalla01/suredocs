import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import EmployeeDashboard from './EmployeeDashboard.jsx'

const owned = [
  { id: 'doc-1', title: 'Employee_Policy.pdf', original_filename: 'Employee_Policy.pdf', owner_name: 'Pooja Gupta', updated_at: new Date().toISOString(), is_owner: true },
  { id: 'doc-2', title: 'Project_Requirements.pdf', original_filename: 'Project_Requirements.pdf', owner_name: 'Pooja Gupta', updated_at: '2026-10-23T16:18:00+05:30', is_owner: true },
]
const shared = [
  { id: 'doc-3', title: 'Financial_Report.xlsx', original_filename: 'Financial_Report.xlsx', owner_name: 'Amit Kumar', updated_at: '2026-10-22T14:22:00+05:30', is_owner: false },
]
const records = {
  '/api/documents/my': { items: owned, total: owned.length },
  '/api/documents/shared': { items: shared, total: shared.length },
  '/api/documents/summary': { owned_documents: 2, shared_with_me: 1, shared_by_me: 1 },
  '/api/users/me/profile': { account_status: 'ACTIVE' },
  '/api/documents/doc-1/permissions': { items: [{ is_effective: true }] },
  '/api/documents/doc-2/permissions': { items: [] },
  '/api/documents/doc-1/audit': { items: [{ id: 'event-1', action_type: 'DOCUMENT_VIEWED', actor_user_id: 'user-1', actor_name: 'Pooja Gupta', occurred_at: new Date().toISOString() }] },
  '/api/documents/doc-2/audit': { items: [{ id: 'event-2', action_type: 'ACCESS_GRANTED', actor_user_id: 'user-1', actor_name: 'Pooja Gupta', occurred_at: '2026-10-23T10:12:00+05:30' }] },
}
window.fetch = async (input) => {
  const path = new URL(typeof input === 'string' ? input : input.url, location.origin).pathname
  const data = records[path]
  return new Response(JSON.stringify(data ?? { detail: 'Unavailable' }), {
    status: data ? 200 : 404,
    headers: { 'Content-Type': 'application/json' },
  })
}
history.replaceState(null, '', '/employee')
createRoot(document.getElementById('root')).render(
  <EmployeeDashboard user={{ id: 'user-1', full_name: 'Pooja Gupta', email: 'pooja@suredocs.example', job_title: 'Product Analyst' }} />,
)
setTimeout(() => {
  const stats = document.createElement('pre')
  stats.id = 'visual-stats'
  stats.style.cssText = 'position:fixed;z-index:9999;left:0;top:0;margin:0;padding:3px 6px;background:#fff;color:#111;font:10px monospace;'
  stats.textContent = JSON.stringify({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    mobile: matchMedia('(max-width:760px)').matches,
    main: document.querySelector('.employee-dashboard-main')?.getBoundingClientRect().width,
    quickCard: document.querySelector('.employee-quick-link')?.getBoundingClientRect().width,
  })
  document.body.append(stats)
}, 1500)
