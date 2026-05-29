const {
    getMyGamification,
    getLeaderboard,
} = require("../services/gamificationService");

const getMyStats = async (req, res) => {
    try {
        const stats = await getMyGamification(req.user.id);

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Failed to fetch gamification stats",
        });
    }
};

const getLeaderboardController = async (req, res) => {
    try {
        const leaderboard = await getLeaderboard(10);

        res.status(200).json({
            success: true,
            data: leaderboard,
        });
    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Failed to fetch leaderboard",
        });
    }
};

module.exports = {
    getMyStats,
    getLeaderboardController,
};