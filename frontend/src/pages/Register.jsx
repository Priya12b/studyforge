import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import API from "../services/api";
import "../styles/auth.css";
import { Link } from "react-router-dom";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const Register = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const trimmedName = formData.name.trim();
      const trimmedEmail = formData.email.trim().toLowerCase();

      if (!trimmedName || !trimmedEmail || !formData.password) {
        toast.error("Please fill in name, email and password");
        return;
      }

      if (!EMAIL_REGEX.test(trimmedEmail)) {
        toast.error("Please enter a valid email address");
        return;
      }

      if (!PASSWORD_REGEX.test(formData.password)) {
        toast.error("Password must be at least 8 characters and include one uppercase letter, one lowercase letter and one number");
        return;
      }

      await API.post(
        "/auth/register",
        {
          ...formData,
          name: trimmedName,
          email: trimmedEmail,
        }
      );

      toast.success("Registration successful. Please log in.");

      navigate("/login", { replace: true });
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.errors?.[0] ||
        "Registration failed";

      toast.error(message);
    }
  };

  return (
    <div className="auth-container">
      <form
        className="auth-card"
        onSubmit={handleSubmit}
        noValidate
      >
        <span className="eyebrow">Join the Platform</span>
        <h1>Register</h1>
        <p>Create your account to generate plans, quizzes and AI notes summaries.</p>

        <input
          type="text"
          name="name"
          placeholder="Name"
          className="input"
          autoComplete="name"
          onChange={handleChange}
        />

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
          autoComplete="new-password"
          onChange={handleChange}
        />

        <button type="submit" className="btn">
          Register
        </button>

        <div className="social-auth">
          <a className="btn-secondary" href="http://localhost:5000/api/auth/google">Sign up with Google</a>
        </div>

        <div className="auth-footer">
          <span>Already have an account?</span>
          <Link className="auth-link" to="/login">Login</Link>
        </div>
      </form>
    </div>
  );
};

export default Register;