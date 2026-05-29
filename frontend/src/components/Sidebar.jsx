import { Link } from "react-router-dom";

const Sidebar = () => {
  return (
    <aside className="sidebar glass">
      <div className="sidebar-top">
        <div className="brand-badge">A</div>
        <div>
          <h2 className="sidebar-title">AI Planner</h2>
          <p className="muted">Adaptive learning workspace</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/tasks">Tasks</Link>
        <Link to="/planner">Planner</Link>
        <Link to="/quiz">Quiz</Link>
        <Link to="/analytics">Analytics</Link>
        <Link to="/attendance">Attendance</Link>
        <Link to="/notes">Notes</Link>
        <Link to="/gamification">Gamification</Link>
        <Link to="/chatbot">Chatbot</Link>
        <Link to="/profile">Profile</Link>
      </nav>
    </aside>
  );
};

export default Sidebar;