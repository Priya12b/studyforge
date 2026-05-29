const Analytics = require("../models/Analytics");

const getAnalytics = async (req, res) => {
  try {
    const analytics = await Analytics.findOne({
      userId: req.user.id,
    });

    res.status(200).json(analytics);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Failed to fetch analytics",
    });
  }
};

module.exports = {
  getAnalytics,
};