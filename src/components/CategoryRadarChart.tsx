import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface CategoryData {
  score: number;
  count: number;
  weight: number;
}

interface CategoryRadarChartProps {
  categoryScores: Record<string, CategoryData>;
}

export function CategoryRadarChart({ categoryScores }: CategoryRadarChartProps) {
  // Transform category data for radar chart
  const radarData = Object.entries(categoryScores).map(([category, data]) => ({
    category: formatCategoryName(category),
    score: data.score,
    fullMark: 100
  }));

  function formatCategoryName(category: string): string {
    const categoryNames: Record<string, string> = {
      military_action: 'Military Action',
      nuclear_program: 'Nuclear Program',
      israel_relations: 'Israel Relations',
      regional_conflict: 'Regional Conflict',
      sanctions: 'Sanctions',
      protests: 'Protests',
      regime_stability: 'Regime Stability'
    };
    return categoryNames[category] || category;
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={radarData}>
          <PolarAngleAxis 
            dataKey="category" 
            tick={{ fontSize: 11, fill: '#9CA3AF' }}
            className="text-xs"
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]} 
            tick={{ fontSize: 9, fill: '#6B7280' }}
            tickCount={5}
          />
          <Radar
            name="Risk Score"
            dataKey="score"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.3}
            strokeWidth={2}
            dot={{ r: 4, fill: '#3B82F6' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}