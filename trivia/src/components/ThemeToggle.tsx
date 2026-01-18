'use client';

import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
      {theme === 'light' ? '🌙' : '☀️'}
      <style jsx>{`
        .theme-toggle {
          position: fixed;
          top: 1rem;
          right: 1rem;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: 2px solid var(--border);
          background: var(--card-bg);
          font-size: 1.2rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          z-index: 1000;
          box-shadow: 0 2px 10px var(--shadow);
        }

        .theme-toggle:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 15px var(--shadow-hover);
        }

        .theme-toggle:active {
          transform: scale(0.95);
        }
      `}</style>
    </button>
  );
}
