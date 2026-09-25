'use client';

import { useState, useEffect } from 'react';

interface FormattedTimeProps {
  isoString: string;
  format?: 'time' | 'datetime';
  className?: string;
}

/**
 * Hydration-safe timestamp formatter.
 * Avoids SSR vs Client locale/timezone mismatch.
 */
export function FormattedTime({ isoString, format = 'time', className }: FormattedTimeProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Deterministic fallback during SSR matching universal ISO time
    return (
      <span className={className}>
        {isoString.slice(11, 16)} UTC
      </span>
    );
  }

  const date = new Date(isoString);

  if (format === 'datetime') {
    return (
      <span className={className}>
        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  }

  return (
    <span className={className}>
      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}
