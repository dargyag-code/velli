'use client';
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const maxW = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-[#1F050F]/45 backdrop-blur-sm" />
      <div
        className={`relative bg-white border border-[#EFE8E4] w-full ${maxW} rounded-t-3xl sm:rounded-3xl shadow-[0_20px_50px_-10px_rgba(59,13,30,0.22)] max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar for mobile */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-[#E8CFC8] rounded-full" />
        </div>

        <div className="p-5 sm:p-6">
          {title && (
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="m-0 font-display text-xl font-semibold tracking-tight text-[#3B0D1E]">
                {title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="min-w-[44px] min-h-[44px] rounded-full bg-[#FAF7F5] hover:bg-[#F5EBE8] border border-[#EFE8E4] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} className="text-[#6B535C]" />
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
