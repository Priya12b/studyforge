import { Link, useLocation } from "react-router-dom";

const Sidebar = () => {
  const location = useLocation();

  const navLink = (to, label) => (
    <Link to={to} className={location.pathname === to ? "active" : ""}>{label}</Link>
  );

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
        {navLink("/dashboard", "Dashboard")}
        {navLink("/tasks", "Tasks")}
        {navLink("/planner", "Planner")}
        {navLink("/quiz", "Quiz")}
        {navLink("/flashcards", "Flashcards")}
        {navLink("/revision", "Revision")}
        {navLink("/analytics", "Analytics")}
        {navLink("/attendance", "Attendance")}
        {navLink("/notes", "Notes")}
        {navLink("/gamification", "Gamification")}
        {navLink("/chatbot", "Chatbot")}
        {navLink("/profile", "Profile")}
      </nav>
    </aside>
  );
};

export default Sidebar;