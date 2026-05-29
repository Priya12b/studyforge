import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import "../styles/layout.css";

const Layout = ({ children }) => {
  return (
    <div className="layout app-shell">
      <Sidebar />

      <div className="main-content">
        <Navbar />

        <main className="page">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;