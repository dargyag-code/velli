import React from 'react';

type BadgeVariant = 'purple' | 'gold' | 'blue' | 'green' | 'orange' | 'gray' | 'red';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  purple: 'bg-[#F3EDF9] text-[#5B2D8E] border border-[#D4B5F0]',
  gold: 'bg-[#FDF8EE] text-[#9A7A2A] border border-[#E8D090]',
  blue: 'bg-blue-50 text-blue-700 border border-blue-200',
  green: 'bg-green-50 text-green-700 border border-green-200',
  orange: 'bg-orange-50 text-orange-700 border border-orange-200',
  gray: 'bg-gray-100 text-gray-600 border border-gray-200',
  red: 'bg-red-50 text-red-700 border border-red-200',
};

export default function Badge({ children, variant = 'purple', className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
        ${variantStyles[variant]}
        ${className}
      `}
      style={{ fontFamily: "'Montserrat', sans-serif" }}
    >
      {children}
    </span>
  );
}
