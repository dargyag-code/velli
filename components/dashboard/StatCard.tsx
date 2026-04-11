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
  purple: { icon: 'bg-[#EEF5ED] text-[#2D5A27]', value: 'text-[#2D5A27]' },
  gold: { icon: 'bg-[#FBF4EC] text-[#C9956B]', value: 'text-[#C9956B]' },
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
          style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
        >
          {value}
        </p>
        <p className="text-xs font-semibold text-[#666666] mt-0.5" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
          {title}
        </p>
        {subtitle && <p className="text-xs text-[#999999] mt-0.5 truncate">{subtitle}</p>}
      </div>
    </Card>
  );
}
