const {
    getTodayAttendance,
    recordAttendance,
    getAttendanceSummary,
} = require("../services/attendanceService");

const markAttendance = async (req, res) => {
    try {
        const { status = "present", note = "" } = req.body;

        const attendance = await recordAttendance({
            userId: req.user.id,
            status,
            note,
            source: "manual",
        });

        const summary = await getAttendanceSummary(req.user.id);
        const today = await getTodayAttendance(req.user.id);

        res.status(200).json({
            success: true,
            message: "Attendance recorded",
            data: {
                attendance,
                summary,
                today,
            },
        });
    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Failed to record attendance",
        });
    }
};

const getMyAttendance = async (req, res) => {
    try {
        const summary = await getAttendanceSummary(req.user.id);
        const today = await getTodayAttendance(req.user.id);

        res.status(200).json({
            success: true,
            data: {
                summary,
                today,
            },
        });
    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Failed to fetch attendance",
        });
    }
};

module.exports = {
    markAttendance,
    getMyAttendance,
};