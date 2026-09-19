'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'dark', setTheme: () => {}, toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark');

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === 'light' || current === 'dark') setThemeState(current);
  }, []);

  const setTheme = useCallback((next) => {
    const value = next === 'light' ? 'light' : 'dark';
    setThemeState(value);
    document.documentElement.dataset.theme = value;
    try {
      localStorage.setItem('synapse-theme', value); // display preference only — never session data
    } catch {
      /* storage unavailable: theme still applies for this page view */
    }
  }, []);

  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
