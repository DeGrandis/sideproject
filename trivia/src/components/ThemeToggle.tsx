'use client';

import { useTheme } from './ThemeProvider';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} color="#ffffff" />}
      <style jsx>{`
        .theme-toggle {
          position: fixed;
          top: 1rem;
          right: 1rem;
          width: 35px;
          height: 35px;
          border-radius: 50%;
          border: 2px solid var(--border);
          background: var(--card-bg);
          font-size: .8rem;
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
