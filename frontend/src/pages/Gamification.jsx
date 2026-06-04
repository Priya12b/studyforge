import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../services/api";
import "../styles/gamification.css";

const Gamification = () => {
    const [profile, setProfile] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [profileRes, leaderboardRes] = await Promise.all([
                API.get("/gamification/me"),
                API.get("/gamification/leaderboard"),
            ]);

            setProfile(profileRes.data.data);
            setLeaderboard(leaderboardRes.data.data || []);
        } catch (err) {
            console.error("[Gamification] loadData failed:", err.message);
            setError("Failed to fetch gamification profile");
            toast.error("Could not load rewards leaderboard");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const xpToNextLevel = profile
        ? Math.max(0, profile.level * 100 - profile.xp)
        : 0;

    return (
        <Layout>
            <div className="gamification-shell">
                <section className="gamification-hero">
                    <span className="eyebrow">Phase 13.7 — Gamification</span>
                    <h1>XP, streaks, badges and leaderboard</h1>
                    <p className="muted">
                        Stay motivated with rewards for tasks, quizzes and daily study habits.
                    </p>
                </section>

                {loading && <LoadingSpinner message="Calculating leaderboard positions and XP counts..." />}

                {error && (
                    <div className="error-card card">
                        <p>{error}</p>
                        <button className="btn-secondary" onClick={loadData}>Retry</button>
                    </div>
                )}

                {!loading && !error && (
                    <>
                        {profile && (
                            <section className="gamification-summary grid">
                                <div className="card metric-card">
                                    <div className="stat-label">XP</div>
                                    <div className="metric-value">{profile.xp}</div>
                                </div>
                                <div className="card metric-card">
                                    <div className="stat-label">Level</div>
                                    <div className="metric-value">{profile.level}</div>
                                </div>
                                <div className="card metric-card">
                                    <div className="stat-label">Streak</div>
                                    <div className="metric-value">{profile.streak} days</div>
                                </div>
                                <div className="card metric-card">
                                    <div className="stat-label">Next Level</div>
                                    <div className="metric-value">{xpToNextLevel} XP left</div>
                                </div>
                            </section>
                        )}

                        {profile && (
                            <section className="card gamification-progress">
                                <div className="section-head">
                                    <h2>Progress</h2>
                                    <span className="muted">{profile.xp} / {profile.level * 100} XP</span>
                                </div>
                                <div className="progress-track">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${Math.min(100, (profile.xp / (profile.level * 100)) * 100)}%` }}
                                    />
                                </div>
                                <div className="gamification-meta">
                                    <span>Tasks: {profile.tasksCompleted}</span>
                                    <span>Quizzes: {profile.quizzesCompleted}</span>
                                    <span>Best score: {profile.highestQuizScore}%</span>
                                    <span>Best streak: {profile.longestStreak} days</span>
                                </div>
                            </section>
                        )}

                        <div className="gamification-grid">
                            <section className="card">
                                <div className="section-head">
                                    <h2>Badges</h2>
                                </div>
                                <div className="badge-list">
                                    {profile?.badges?.length ? (
                                        profile.badges.map((badge) => (
                                            <article key={badge.key} className="badge-chip">
                                                <strong>{badge.name}</strong>
                                                <p>{badge.description}</p>
                                            </article>
                                        ))
                                    ) : (
                                        <p className="muted">Badges will appear after you complete tasks, quizzes and streaks.</p>
                                    )}
                                </div>
                            </section>

                            <section className="card">
                                <div className="section-head">
                                    <h2>Leaderboard</h2>
                                </div>
                                <div className="leaderboard-list">
                                    {leaderboard.length === 0 ? (
                                        <p className="muted">No students on leaderboard yet.</p>
                                    ) : (
                                        leaderboard.map((entry, index) => (
                                            <div key={entry._id} className="leaderboard-row">
                                                <div>
                                                    <strong>#{index + 1} {entry.userId?.name || "Student"}</strong>
                                                    <p className="muted">Level {entry.level} • Streak {entry.streak}</p>
                                                </div>
                                                <span>{entry.xp} XP</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
};

export default Gamification;