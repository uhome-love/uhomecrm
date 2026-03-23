import { useState, useEffect } from "react";

type Theme = "light" | "dark";

export function useTheme(defaultTheme: Theme = "light") {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    return (localStorage.getItem("uhomesales-theme") as Theme) ?? defaultTheme;
  });

  useEffect(() => {
    localStorage.setItem("uhomesales-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const toggle = () => setTheme(t => (t === "light" ? "dark" : "light"));
  return { theme, toggle };
}
