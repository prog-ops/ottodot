'use client';

import { useState, useEffect } from 'react';

export function ThemeToggle() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check initial preference or class
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const toggleTheme = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  if (!mounted) {
    return (
      <button
        disabled
        className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-700 text-white opacity-80"
      >
        🌙 Dark
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      title="Toggle Light / Dark Mode"
      className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-700 text-white hover:bg-slate-600 transition-all shadow-sm"
    >
      {isDarkMode ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
