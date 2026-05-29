const Analytics = require("../models/Analytics");

const updateUserAnalytics = async (
  userId,
  data
) => {
  try {
    let analytics = await Analytics.findOne({
      userId,
    });

    // create if not exists
    if (!analytics) {
      analytics = await Analytics.create({
        userId,
      });
    }

    // update completed tasks
    if (data.tasksCompleted) {
      analytics.tasksCompleted +=
        data.tasksCompleted;
    }

    // update study hours
    if (data.studyHours) {
      analytics.studyHours += data.studyHours;
    }

    // update weak topics
    if (data.weakTopics) {
      analytics.weakTopics = [
        ...new Set([
          ...analytics.weakTopics,
          ...data.weakTopics,
        ]),
      ];
    }

    analytics.lastActiveDate = new Date();

    await analytics.save();

    return analytics;
  } catch (error) {
    console.log(error);

    throw error;
  }
};

module.exports = {
  updateUserAnalytics,
};