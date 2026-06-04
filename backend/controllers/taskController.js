const Task = require("../models/Task");

const {
    updateUserAnalytics,
} = require("../services/analyticsService");

const {
    awardTaskCompletion,
} = require("../services/gamificationService");

// CREATE TASK
const createTask = async (req, res) => {
    try {
        const task = await Task.create({
            userId: req.user.id,
            title: req.body.title,
            description: req.body.description,
            dueDate: req.body.dueDate,
            priority: req.body.priority,
        });

        res.status(201).json(task);
    } catch (error) {
        console.error("[taskController] createTask failed:", error.message || error);

        res.status(500).json({
            message: "Failed to create task",
        });
    }
};

// GET ALL TASKS
const getTasks = async (req, res) => {
    try {
        if (req.query.page) {
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 10, 100);
            const skip = (page - 1) * limit;

            const [tasks, total] = await Promise.all([
                Task.find({ userId: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
                Task.countDocuments({ userId: req.user.id }),
            ]);

            return res.status(200).json({
                success: true,
                tasks,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            });
        }

        const tasks = await Task.find({
            userId: req.user.id,
        }).sort({ createdAt: -1 });

        res.status(200).json(tasks);
    } catch (error) {
        console.error("[taskController] getTasks failed:", error.message || error);

        res.status(500).json({
            message: "Failed to fetch tasks",
        });
    }
};

const updateTask = async (req, res) => {
    try {
        const existingTask = await Task.findOne({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!existingTask) {
            return res.status(404).json({
                message: "Task not found",
            });
        }

        // Whitelist allowed fields to prevent injection
        const allowedFields = {};
        if (req.body.title !== undefined) allowedFields.title = req.body.title;
        if (req.body.description !== undefined) allowedFields.description = req.body.description;
        if (req.body.dueDate !== undefined) allowedFields.dueDate = req.body.dueDate;
        if (req.body.priority !== undefined) allowedFields.priority = req.body.priority;
        if (req.body.completed !== undefined) allowedFields.completed = req.body.completed;

        const updatedTask = await Task.findOneAndUpdate(
            {
                _id: req.params.id,
                userId: req.user.id,
            },
            allowedFields,
            {
                new: true,
            }
        );

        // update analytics if completed
        if (!existingTask.completed && allowedFields.completed === true) {
            await updateUserAnalytics(req.user.id, {
                tasksCompleted: 1,
            });

            try {
                await awardTaskCompletion(req.user.id);
            } catch (rewardError) {
                console.error("[taskController] awardTaskCompletion failed:", rewardError.message || rewardError);
            }
        }

        res.status(200).json(updatedTask);
    } catch (error) {
        console.error("[taskController] updateTask failed:", error.message || error);

        res.status(500).json({
            message: "Failed to update task",
        });
    }
};

// DELETE TASK
const deleteTask = async (req, res) => {
    try {
        const deletedTask = await Task.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!deletedTask) {
            return res.status(404).json({
                message: "Task not found",
            });
        }

        res.status(200).json({
            message: "Task deleted",
        });
    } catch (error) {
        console.error("[taskController] deleteTask failed:", error.message || error);

        res.status(500).json({
            message: "Failed to delete task",
        });
    }
};

module.exports = {
    createTask,
    getTasks,
    updateTask,
    deleteTask,
};