const Attendance = require("../models/Attendance");

const startOfDay = (date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
};

const getTodayAttendance = async (userId) => {
    const today = startOfDay(new Date());

    return Attendance.findOne({
        userId,
        attendanceDate: today,
    });
};

const recordAttendance = async ({
    userId,
    status,
    note,
    source = "manual",
}) => {
    const today = startOfDay(new Date());

    return Attendance.findOneAndUpdate(
        {
            userId,
            attendanceDate: today,
        },
        {
            userId,
            attendanceDate: today,
            status,
            note: note || "",
            source,
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
        }
    );
};

const getAttendanceSummary = async (userId) => {
    const records = await Attendance.find({ userId }).sort({ attendanceDate: -1 });

    const totalDays = records.length;
    const presentDays = records.filter((record) => record.status === "present").length;
    const lateDays = records.filter((record) => record.status === "late").length;
    const absentDays = records.filter((record) => record.status === "absent").length;

    let streak = 0;
    const sorted = [...records].sort((left, right) => right.attendanceDate - left.attendanceDate);

    for (let index = 0; index < sorted.length; index += 1) {
        const current = new Date(sorted[index].attendanceDate);
        current.setHours(0, 0, 0, 0);

        const expected = startOfDay(new Date());
        expected.setDate(expected.getDate() - index);

        if (current.getTime() === expected.getTime() && sorted[index].status !== "absent") {
            streak += 1;
        } else {
            break;
        }
    }

    return {
        totalDays,
        presentDays,
        lateDays,
        absentDays,
        streak,
        recentRecords: records.slice(0, 7),
    };
};

module.exports = {
    getTodayAttendance,
    recordAttendance,
    getAttendanceSummary,
};