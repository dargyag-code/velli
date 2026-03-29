'use client';
import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChange, placeholder = 'Buscar clienta...' }: SearchBarProps) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-[#E5E5E5] bg-white text-sm text-[#2D2D2D] placeholder-[#BBBBBB] transition-all duration-200"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AAAAAA] hover:text-[#666666] transition-colors"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
