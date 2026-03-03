import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface MarketChartProps {
  history: Array<{ timestamp: number; probability: number }>;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

export function MarketChart({ history }: MarketChartProps) {
  if (!history || history.length === 0) {
    return (
      <div className="bg-base-200 rounded-lg p-8 text-center opacity-50">
        <p>No historical data available</p>
      </div>
    );
  }

  return (
    <div className="bg-base-200 rounded-lg p-2" style={{ height: '260px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.08} />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={formatDate}
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            angle={-45}
            textAnchor="end"
            height={40}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            label={{ value: '%', angle: 0, position: 'top' }}
            width={30}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--chart-tooltip-bg, #1F2937)',
              border: '1px solid var(--chart-tooltip-border, #374151)',
              borderRadius: '8px',
              color: 'var(--chart-tooltip-text, #F9FAFB)'
            }}
            labelFormatter={(ts) => new Date(ts as number).toLocaleString()}
            formatter={(value) => [`${String(value)}%`, 'Probability']}
          />
          <Line
            type="monotone"
            dataKey="probability"
            stroke="#3B82F6"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
