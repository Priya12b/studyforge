const User = require("../models/User");

const requireRole = (role) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  // If role is missing from token (or stale), look it up in the database
  if (!req.user.role) {
    try {
      const user = await User.findById(req.user.id || req.user._id);
      if (user) {
        req.user.role = user.role;
      }
    } catch (error) {
      console.error("[roleMiddleware] Error fetching user role:", error.message);
    }
  }

  if (req.user.role === role) {
    return next();
  }

  return res.status(403).json({
    message: `Access forbidden: ${role.charAt(0).toUpperCase() + role.slice(1)} privilege required.`,
  });
};

module.exports = requireRole;
