const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        attendanceDate: {
            type: Date,
            required: true,
            index: true,
        },

        status: {
            type: String,
            enum: ["present", "late", "absent"],
            default: "present",
        },

        note: {
            type: String,
            default: "",
        },

        source: {
            type: String,
            default: "manual",
        },
    },
    {
        timestamps: true,
    }
);

attendanceSchema.index(
    { userId: 1, attendanceDate: 1 },
    { unique: true }
);

module.exports = mongoose.model("Attendance", attendanceSchema);