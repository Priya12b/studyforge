import { useEffect, useState, useContext } from "react";
import toast from "react-hot-toast";
import { Link, useLocation, Navigate } from "react-router-dom";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import "../styles/auth.css";

const Login = () => {
  const { login, setAuthFromQuery, isAuthenticated } = useContext(AuthContext);
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const user = params.get("user");
    const error = params.get("error");

    if (error === "google_oauth_failed") {
      toast.error("Google sign-in failed. Please try again.");
    }

    if (token && user) {
      try {
        setAuthFromQuery(token, JSON.parse(user));
      } catch (error) {
        console.log(error);
        toast.error("Could not complete Google sign-in.");
      }
    }
  }, [location.search, setAuthFromQuery]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (!formData.email.trim() || !formData.password.trim()) {
        toast.error("Please enter both email and password");
        return;
      }

      const res = await API.post("/auth/login", formData);

      login(res.data);
      toast.success("Login successful");
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Login failed. Please check your credentials.";

      toast.error(message);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <span className="eyebrow">Welcome Back</span>
        <h1>Login</h1>
        <p>Access your adaptive planner, notes and analytics dashboard.</p>

        <input
          type="email"
          name="email"
          placeholder="Email"
          className="input"
          autoComplete="email"
          onChange={handleChange}
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          className="input"
          autoComplete="current-password"
          onChange={handleChange}
        />

        <button type="submit" className="btn">Login</button>

        <div className="social-auth">
          <a className="btn-secondary" href="http://localhost:5000/api/auth/google">Continue with Google</a>
        </div>

        <div className="auth-footer">
          <span>New here?</span>
          <Link className="auth-link" to="/register">Create account</Link>
        </div>
      </form>
    </div>
  );
};

export default Login;