import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface MarketChartProps {
  history: Array<{ timestamp: number; probability: number }>;
}

export function MarketChart({ history }: MarketChartProps) {
  if (!history || history.length === 0) {
    return (
      <div className="bg-base-200 rounded-lg p-8 text-center opacity-50">
        <p>No historical data available</p>
      </div>
    );
  }

  const chartData = history.map(point => ({
    date: new Date(point.timestamp).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }),
    probability: point.probability
  }));

  return (
    <div className="bg-base-200 rounded-lg p-2" style={{ height: '260px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 10 }}
            stroke="#9CA3AF"
            interval="preserveStartEnd"
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
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB'
            }}
            formatter={(value) => [`${String(value)}%`, 'Probability']}
          />
          <Line 
            type="monotone" 
            dataKey="probability" 
            stroke="#3B82F6" 
            strokeWidth={2.5}
            dot={{ fill: '#3B82F6', strokeWidth: 0, r: 0 }}
            activeDot={{ r: 5, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}