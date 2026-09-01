import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card = ({ children, className = '' }: CardProps) => (
  <div className={`rounded-md border border-border bg-surface p-5 shadow-card ${className}`}>
    {children}
  </div>
);
