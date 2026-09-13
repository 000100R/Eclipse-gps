import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '', id }) => {
  return (
    <div
      id={id}
      className={`bg-neutral-900/80 backdrop-blur-md border border-neutral-800/60 rounded-xl shadow-2xl overflow-hidden transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
};
