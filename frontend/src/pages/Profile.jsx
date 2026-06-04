import { useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";

import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import { AuthContext } from "../context/AuthContext";
import API from "../services/api";
import "../styles/dashboard.css";

const Profile = () => {
  const { user, login } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [gamification, setGamification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const [profileRes, gamRes] = await Promise.all([
          API.get("/auth/profile"),
          API.get("/gamification/me").catch(() => null),
        ]);

        setProfile(profileRes.data);
        setEditName(profileRes.data.name || "");

        if (gamRes?.data?.data) {
          setGamification(gamRes.data.data);
        }
      } catch (error) {
        console.error("[Profile] Load failed:", error.message);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!editName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    try {
      setSaving(true);
      const res = await API.put("/auth/profile", { name: editName.trim() });

      setProfile(res.data.user);
      // Update localStorage user data
      login({ token: localStorage.getItem("token"), user: res.data.user });
      toast.success("Profile updated");
    } catch (error) {
      console.error("[Profile] Save failed:", error.message);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="dashboard-shell">
        <div>
          <span className="eyebrow">Profile</span>
          <h1>User Profile</h1>
          <p className="muted">Your account, progress and adaptive learning identity.</p>
        </div>

        {loading && <LoadingSpinner message="Loading profile..." />}

        {!loading && profile && (
          <>
            <div className="dashboard-panel" style={{ marginTop: 20 }}>
              <div className="grid" style={{ gap: 16 }}>
                <div>
                  <div className="stat-label">Name</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
                    <input
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ maxWidth: 320 }}
                    />
                    <button
                      className="btn-secondary"
                      onClick={handleSave}
                      disabled={saving || editName === profile.name}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="stat-label">Email</div>
                  <div className="stat-value" style={{ fontSize: "1.25rem" }}>
                    {profile.email || "Not available"}
                  </div>
                </div>

                <div>
                  <div className="stat-label">Role</div>
                  <div className="stat-value" style={{ fontSize: "1.25rem" }}>
                    {profile.role || "student"}
                  </div>
                </div>

                <div>
                  <div className="stat-label">Auth Provider</div>
                  <div className="stat-value" style={{ fontSize: "1.25rem" }}>
                    {profile.authProvider || "local"}
                  </div>
                </div>

                {profile.createdAt && (
                  <div>
                    <div className="stat-label">Member Since</div>
                    <div className="stat-value" style={{ fontSize: "1.25rem" }}>
                      {new Date(profile.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {gamification && (
              <div style={{ marginTop: 20 }}>
                <h2 style={{ marginBottom: 14 }}>Gamification Stats</h2>
                <div className="stats-grid">
                  <div className="stat">
                    <div className="stat-label">XP</div>
                    <div className="stat-value">{gamification.xp}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Level</div>
                    <div className="stat-value">{gamification.level}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Streak</div>
                    <div className="stat-value">{gamification.streak} days</div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Tasks Done</div>
                    <div className="stat-value">{gamification.tasksCompleted}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Quizzes Done</div>
                    <div className="stat-value">{gamification.quizzesCompleted}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Badges</div>
                    <div className="stat-value">{gamification.badges?.length || 0}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Profile;