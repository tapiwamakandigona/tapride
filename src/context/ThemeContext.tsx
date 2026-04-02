import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

// [INTENT] App-wide theme context with dark mode toggle and persistence
// [CONSTRAINT] Must work in Capacitor webview where localStorage and matchMedia may be restricted
// [EDGE-CASE] SSR or prerender environments may not have window — safe access patterns throughout

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

// [INTENT] Default context allows useTheme() outside provider without crashing (graceful degradation)
const ThemeContext = createContext<ThemeContextType>({ theme: 'light', toggleTheme: () => {} });

// [INTENT] Safely read persisted theme, falling back to system preference then 'light'
function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('tapride-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // [EDGE-CASE] localStorage blocked (incognito Safari, Capacitor edge cases)
  }
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    // [EDGE-CASE] matchMedia unavailable in some webview environments
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // [INTENT] Sync dark class on <html> and persist preference
  // [CONSTRAINT] Tailwind's dark mode relies on the 'dark' class on documentElement
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('tapride-theme', theme);
    } catch {
      // [EDGE-CASE] localStorage full or blocked — theme still works for current session
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
