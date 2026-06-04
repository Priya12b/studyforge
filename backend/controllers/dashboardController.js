const {
  getDashboardData,
} = require("../services/dashboardService");

const getDashboard = async (
  req,
  res
) => {
  try {
    const dashboardData =
      await getDashboardData(
        req.user.id
      );

    res.status(200).json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error("[DashboardController] getDashboard failed:", error.message || error);

    res.status(500).json({
      message:
        "Failed to fetch dashboard",
    });
  }
};

module.exports = {
  getDashboard,
};