import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function displayDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en', options).format(new Date(value))
}

export default function AdminAuditActivityChart({ data }) {
  return (
    <ResponsiveContainer height="100%" width="100%">
      <BarChart data={data} margin={{ top: 5, right: 3, left: -17, bottom: 0 }} barGap={1}>
        <CartesianGrid stroke="#e8edf5" vertical={false} />
        <XAxis axisLine={false} dataKey="date" tick={{ fill: '#74819a', fontSize: 9 }} tickLine={false} tickFormatter={(value) => displayDate(value, { month: 'short', day: 'numeric' })} />
        <YAxis allowDecimals={false} axisLine={false} tick={{ fill: '#74819a', fontSize: 9 }} tickLine={false} width={30} />
        <Tooltip labelFormatter={(value) => displayDate(value)} />
        <Bar dataKey="success" fill="#3478f6" name="Successful Actions" radius={[2, 2, 0, 0]} stackId="events" />
        <Bar dataKey="denied" fill="#ff6268" name="Denied Actions" radius={[2, 2, 0, 0]} stackId="events" />
      </BarChart>
    </ResponsiveContainer>
  )
}
