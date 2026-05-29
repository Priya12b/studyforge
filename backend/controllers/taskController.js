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
        console.log(error);

        res.status(500).json({
            message: "Failed to create task",
        });
    }
};


// GET ALL TASKS
const getTasks = async (req, res) => {
    try {
        const tasks = await Task.find({
            userId: req.user.id,
        });

        res.status(200).json(tasks);
    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Failed to fetch tasks",
        });
    }
};


// // UPDATE TASK
// const updateTask = async (req, res) => {
//   try {
//     const updatedTask = await Task.findByIdAndUpdate(
//       req.params.id,
//       req.body,
//       {
//         new: true,
//       }
//     );

//     res.status(200).json(updatedTask);
//   } catch (error) {
//     console.log(error);

//     res.status(500).json({
//       message: "Failed to update task",
//     });
//   }
// };

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

        const updatedTask = await Task.findOneAndUpdate(
            {
                _id: req.params.id,
                userId: req.user.id,
            },
            req.body,
            {
                new: true,
            }
        );

        // update analytics if completed
        if (!existingTask.completed && req.body.completed === true) {
            await updateUserAnalytics(req.user.id, {
                tasksCompleted: 1,
            });

            try {
                await awardTaskCompletion(req.user.id);
            } catch (rewardError) {
                console.log(rewardError);
            }
        }

        res.status(200).json(updatedTask);
    } catch (error) {
        console.log(error);

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
        console.log(error);

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