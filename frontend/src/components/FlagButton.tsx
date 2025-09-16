import React from 'react';
import { motion } from 'framer-motion';

interface FlagButtonProps {
  base64: string;
  label?: string;
  onClick: () => void;
  withLabel?: boolean;
  disabled?: boolean;
}

export function FlagButton({
  base64,
  label,
  onClick,
  withLabel = true,
  disabled = false,
}: FlagButtonProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      disabled={disabled}
      className={`flex flex-col items-center gap-3 p-4 rounded-3xl shadow-lg bg-white/90 text-dark transition-transform focus:outline-none focus:ring-4 focus:ring-secondary/60 w-full max-w-[220px] ${disabled ? 'opacity-60' : 'hover:-translate-y-1'}`}
      onClick={onClick}
    >
      <img
        src={base64}
        alt={label || 'Flag'}
        className="w-44 h-28 object-cover rounded-2xl border-4 border-secondary"
      />
      {withLabel && label && (
        <div className="text-xl font-extrabold tracking-wide text-dark text-center">
          {label}
        </div>
      )}
    </motion.button>
  );
}
