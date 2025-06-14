import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface RiskScoreGaugeProps {
  score: number;
  size?: number;
}

export function RiskScoreGauge({ score, size = 200 }: RiskScoreGaugeProps) {
  // Create gauge data - semicircle gauge
  const gaugeData = [
    { name: 'filled', value: score, color: getScoreColor(score) },
    { name: 'empty', value: 100 - score, color: '#374151' }
  ];

  function getScoreColor(score: number): string {
    if (score >= 70) return '#EF4444'; // red-500
    if (score >= 50) return '#F59E0B'; // amber-500
    if (score >= 30) return '#EAB308'; // yellow-500
    return '#10B981'; // emerald-500
  }

  function getScoreLabel(score: number): string {
    if (score >= 70) return 'High Risk';
    if (score >= 50) return 'Elevated Risk';
    if (score >= 30) return 'Moderate Risk';
    return 'Low Risk';
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size / 2 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={size * 0.25}
              outerRadius={size * 0.4}
              dataKey="value"
              strokeWidth={0}
            >
              {gaugeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        {/* Score display */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-4">
          <div className="text-3xl font-bold text-center">
            {score}%
          </div>
          <div className="text-sm opacity-70 text-center">
            {getScoreLabel(score)}
          </div>
        </div>
      </div>
    </div>
  );
}