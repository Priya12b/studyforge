import { useContext } from "react";

import Layout from "../components/Layout";
import { AuthContext } from "../context/AuthContext";

const Profile = () => {
  const { user } = useContext(AuthContext);

  return (
    <Layout>
      <div className="dashboard-shell">
        <div>
          <span className="eyebrow">Profile</span>
          <h1>User Profile</h1>
          <p className="muted">Your account, progress and adaptive learning identity.</p>
        </div>

        <div className="dashboard-panel">
          <div className="grid" style={{ gap: 10 }}>
            <div className="stat-label">Name</div>
            <div className="stat-value" style={{ fontSize: "1.25rem" }}>{user?.name || "Student"}</div>

            <div className="stat-label">Email</div>
            <div className="stat-value" style={{ fontSize: "1.25rem" }}>{user?.email || "Not available"}</div>

            <div className="stat-label">Role</div>
            <div className="stat-value" style={{ fontSize: "1.25rem" }}>{user?.role || "student"}</div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;