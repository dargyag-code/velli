import React from 'react';
import Card from '../ui/Card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'purple' | 'gold' | 'green' | 'blue';
  subtitle?: string;
}

const colorMap = {
  purple: { icon: 'bg-[#F3EDF9] text-[#5B2D8E]', value: 'text-[#5B2D8E]' },
  gold: { icon: 'bg-[#FDF8EE] text-[#C9A84C]', value: 'text-[#C9A84C]' },
  green: { icon: 'bg-green-50 text-green-600', value: 'text-green-600' },
  blue: { icon: 'bg-blue-50 text-blue-600', value: 'text-blue-600' },
};

export default function StatCard({ title, value, icon, color = 'purple', subtitle }: StatCardProps) {
  const colors = colorMap[color];
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-xl ${colors.icon}`}>{icon}</div>
      </div>
      <div>
        <p
          className={`text-2xl font-bold ${colors.value}`}
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          {value}
        </p>
        <p className="text-xs font-semibold text-[#666666] mt-0.5" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          {title}
        </p>
        {subtitle && <p className="text-xs text-[#999999] mt-0.5 truncate">{subtitle}</p>}
      </div>
    </Card>
  );
}
