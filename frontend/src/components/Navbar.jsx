import { useContext, useState, useEffect } from "react";
import { Link } from "react-router-dom";

import { ThemeContext } from "../context/ThemeContext";
import { AuthContext } from "../context/AuthContext";

const Navbar = () => {
    const { darkMode, toggleTheme } = useContext(ThemeContext);
    const { user, logout } = useContext(AuthContext);

    // AI Provider and Model states
    const [provider, setProvider] = useState(localStorage.getItem("activeProvider") || "gemini");
    const [model, setModel] = useState(localStorage.getItem("activeModel") || "google/gemini-2.5-flash");

    // Save choices to localStorage
    useEffect(() => {
        localStorage.setItem("activeProvider", provider);
    }, [provider]);

    useEffect(() => {
        localStorage.setItem("activeModel", model);
    }, [model]);

    // Handle provider changes to pick a sensible default model
    const handleProviderChange = (e) => {
        const nextProvider = e.target.value;
        setProvider(nextProvider);
        if (nextProvider === "gemini") {
            setModel("google/gemini-2.5-flash");
        } else if (nextProvider === "ollama") {
            setModel("llama3.1:8b");
        } else if (nextProvider === "openrouter") {
            setModel("google/gemini-2.5-flash");
        }
    };

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
                {user && (
                    <div className="ai-model-selector" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginRight: '16px', background: 'var(--panel-solid)', padding: '6px 12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.05em' }}>AI Engine:</span>
                        <select 
                            value={provider} 
                            onChange={handleProviderChange}
                            style={{ border: 'none', background: 'transparent', color: 'var(--text-strong)', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', outline: 'none' }}
                        >
                            <option value="gemini">Gemini</option>
                            <option value="ollama">Ollama (Local)</option>
                            <option value="openrouter">OpenRouter</option>
                        </select>
                        <span style={{ color: 'var(--border-strong)', fontSize: '0.9rem' }}>|</span>
                        <select 
                            value={model} 
                            onChange={(e) => setModel(e.target.value)}
                            style={{ border: 'none', background: 'transparent', color: 'var(--text-strong)', fontSize: '0.85rem', fontWeight: '500', cursor: 'pointer', outline: 'none', maxWidth: '200px' }}
                        >
                            {provider === "gemini" && (
                                <>
                                    <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                                    <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                                </>
                            )}
                            {provider === "ollama" && (
                                <>
                                    <option value="llama3.1:8b">Llama 3.1 8B</option>
                                    <option value="tinyllama">TinyLlama</option>
                                </>
                            )}
                            {provider === "openrouter" && (
                                <>
                                    <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                                    <option value="meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
                                    <option value="meta-llama/llama-3.1-8b-instruct">Llama 3.1 8B</option>
                                    <option value="deepseek/deepseek-chat">DeepSeek Chat</option>
                                    <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                                    <option value="mistralai/mistral-large">Mistral Large</option>
                                </>
                            )}
                        </select>
                    </div>
                )}

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