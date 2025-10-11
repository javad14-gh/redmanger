import React from 'react';
import { cn } from '@/lib/utils';

const Logo = ({ className }: { className?: string }) => {
  return (
    <div className={cn('relative w-16 h-16', className)}>
      {/* Using a standard img tag to prevent potential build errors with next/image on server environments */}
      <img
        src="/logo.png"
        alt="Red Fries Logo"
        className="h-full w-full object-contain"
      />
    </div>
  );
};

export default Logo;
