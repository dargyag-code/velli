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
    ring:   'bg-[#EEF5ED]',
    dot:    'linear-gradient(135deg, #2D5A27, #3D7A35)',
    value:  '#2D5A27',
    glow:   'rgba(45,90,39,0.15)',
  },
  gold: {
    ring:   'bg-[#FBF4EC]',
    dot:    'linear-gradient(135deg, #C9956B, #D4A882)',
    value:  '#C9956B',
    glow:   'rgba(201,149,107,0.15)',
  },
  blue: {
    ring:   'bg-[#E8F4FD]',
    dot:    'linear-gradient(135deg, #1A5276, #2E86C1)',
    value:  '#1A5276',
    glow:   'rgba(26,82,118,0.12)',
  },
  purple: {
    ring:   'bg-[#EEF5ED]',
    dot:    'linear-gradient(135deg, #2D5A27, #4A8A40)',
    value:  '#2D5A27',
    glow:   'rgba(45,90,39,0.15)',
  },
};

export default function StatCard({ title, value, icon, color = 'green', subtitle }: StatCardProps) {
  const c = colorMap[color];
  const serif = { fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" };

  return (
    <div
      className="bg-white rounded-2xl p-4 border border-[#E5E5E5] flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5"
      style={{ boxShadow: `0 2px 12px ${c.glow}` }}
    >
      {/* Icon circle */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm"
        style={{ background: c.dot }}
      >
        <span className="[&>svg]:w-5 [&>svg]:h-5">{icon}</span>
      </div>

      {/* Value */}
      <div>
        <p
          className="text-3xl font-bold leading-none"
          style={{ color: c.value, ...serif }}
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
