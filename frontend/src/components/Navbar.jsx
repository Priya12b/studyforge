import { useContext } from "react";
import { Link } from "react-router-dom";

import { ThemeContext } from "../context/ThemeContext";
import { AuthContext } from "../context/AuthContext";

const Navbar = () => {
    const { darkMode, toggleTheme } = useContext(ThemeContext);
    const { user, logout } = useContext(AuthContext);

    return (
        <header className="navbar glass">
            <div className="navbar-brand">
                <div className="navbar-mark">AI</div>
                <div>
                    <h2 className="navbar-title">Adaptive Study AI</h2>
                    <p className="muted">
                        {user ? `Welcome back, ${user.name}` : "Personalized study planning, analytics and AI notes"}
                    </p>
                </div>
            </div>

            <div className="navbar-actions">
                <button onClick={toggleTheme} className="btn-secondary">
                    {darkMode ? "Light Mode" : "Dark Mode"}
                </button>
                {user ? (
                    <button onClick={logout} className="btn-ghost">Logout</button>
                ) : (
                    <Link to="/login" className="btn-ghost">Login</Link>
                )}
            </div>
        </header>
    );
};

export default Navbar;