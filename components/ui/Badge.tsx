import React from 'react';

type BadgeVariant = 'purple' | 'gold' | 'blue' | 'green' | 'orange' | 'gray' | 'red';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  purple: 'bg-[#EEF5ED] text-[#2D5A27] border border-[#D4B5F0]',
  gold: 'bg-[#FBF4EC] text-[#9A6A3A] border border-[#E0C4A0]',
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
      style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}
    >
      {children}
    </span>
  );
}
