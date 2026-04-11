import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'green' | 'gold' | 'blue' | 'purple';
  subtitle?: string;
}

const colorMap = {
  green: {
    ring:    'bg-[#EEF5ED]',
    dot:     'linear-gradient(135deg, #2D5A27, #3D7A35)',
    value:   '#2D5A27',
    glow:    'rgba(45,90,39,0.15)',
    border:  '#2D5A27',
  },
  gold: {
    ring:    'bg-[#FBF4EC]',
    dot:     'linear-gradient(135deg, #C9956B, #D4A882)',
    value:   '#C9956B',
    glow:    'rgba(201,149,107,0.15)',
    border:  '#C9956B',
  },
  blue: {
    ring:    'bg-[#E8F4FD]',
    dot:     'linear-gradient(135deg, #1A5276, #2E86C1)',
    value:   '#1A5276',
    glow:    'rgba(26,82,118,0.12)',
    border:  '#1A5276',
  },
  purple: {
    ring:    'bg-[#F3EDF9]',
    dot:     'linear-gradient(135deg, #6B3FA0, #9B6FD0)',
    value:   '#6B3FA0',
    glow:    'rgba(107,63,160,0.12)',
    border:  '#6B3FA0',
  },
};

export default function StatCard({ title, value, icon, color = 'green', subtitle }: StatCardProps) {
  const c = colorMap[color];
  const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

  return (
    <div
      className="bg-white rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        borderLeft: `4px solid ${c.border}`,
        borderTop: '1px solid #E5E5E5',
        borderRight: '1px solid #E5E5E5',
        borderBottom: '1px solid #E5E5E5',
        borderRadius: 16,
      }}
    >
      {/* Icon circle */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm"
        style={{ background: c.dot }}
      >
        <span className="[&>svg]:w-5 [&>svg]:h-5">{icon}</span>
      </div>

      {/* Value */}
      <div>
        <p
          className="font-bold leading-none"
          style={{ color: c.value, fontSize: 36, ...serif }}
        >
          {value}
        </p>
        <p className="text-xs font-semibold text-[#666666] mt-1" style={serif}>
          {title}
        </p>
        {subtitle && (
          <p className="text-[10px] text-[#999999] mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
