/* eslint-disable react-refresh/only-export-components */

import {
    createContext,
    useState,
    useEffect,
} from "react";

export const ThemeContext =
    createContext();

export const ThemeProvider = ({
    children,
}) => {
    const [darkMode, setDarkMode] = useState(() => {
        try {
            const stored = localStorage.getItem("darkMode");
            if (stored !== null) return stored === "true";
        } catch {
            /* ignore */
        }

        // fall back to prefers-color-scheme
        try {
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        } catch {
            return false;
        }
    });

    const toggleTheme = () => {
        setDarkMode((currentMode) => {
            const next = !currentMode;
            try {
                localStorage.setItem("darkMode", String(next));
            } catch {
                return;
            }
            return next;
        });
    };

    useEffect(() => {
        try {
            document.documentElement.classList.toggle("dark", darkMode);
        } catch {
            // noop for non-browser environments
        }
    }, [darkMode]);

    return (
        <ThemeContext.Provider
            value={{
                darkMode,
                toggleTheme,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
};