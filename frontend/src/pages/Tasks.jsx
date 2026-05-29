/* eslint-disable react-hooks/set-state-in-effect */

import {
  useEffect,
  useState,
} from "react";

import toast from "react-hot-toast";

import Layout from "../components/Layout";
import API from "../services/api";

import "../styles/tasks.css";

const Tasks = () => {
  const [tasks, setTasks] =
    useState([]);

  const [formData, setFormData] =
    useState({
      title: "",
      description: "",
      dueDate: "",
      priority: "medium",
    });

  const fetchTasks = async () => {
    try {
      const res = await API.get("/tasks");
      setTasks(res.data);
    } catch (error) {
      console.log(error);
      toast.error("Failed to load tasks");
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]:
        e.target.value,
    });
  };

  const createTask = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Please enter a title and description");
      return;
    }

    try {
      await API.post(
        "/tasks",
        formData
      );

      fetchTasks();
      toast.success("Task Created");

      setFormData({
        title: "",
        description: "",
        dueDate: "",
        priority: "medium",
      });
    } catch (error) {
      console.log(error);
      toast.error("Could not create task");
    }
  };

  const markComplete = async (
    id
  ) => {
    try {
      await API.put(
        `/tasks/${id}`,
        {
          completed: true,
        }
      );

      fetchTasks();
      toast.success("Task marked complete");
    } catch (error) {
      console.log(error);
      toast.error("Could not update task");
    }
  };

  const deleteTask = async (id) => {
    try {
      await API.delete(`/tasks/${id}`);
      fetchTasks();
      toast.success("Task deleted");
    } catch (error) {
      console.log(error);
      toast.error("Could not delete task");
    }
  };

  return (
    <Layout>
      <div className="tasks-container">
        <section className="tasks-header">
          <div>
            <span className="eyebrow">Productivity Control Center</span>
            <h1>Task Manager</h1>
            <p className="muted">Create, track and complete your daily study tasks with priority support.</p>
          </div>
        </section>

        <form onSubmit={createTask} className="task-form surface page-card">
          <input
            type="text"
            name="title"
            placeholder="Task Title"
            className="input"
            value={formData.title}
            onChange={handleChange}
          />

          <input
            type="text"
            name="description"
            placeholder="Description"
            className="input"
            value={
              formData.description
            }
            onChange={handleChange}
          />

          <input
            type="date"
            name="dueDate"
            className="input"
            value={formData.dueDate}
            onChange={handleChange}
          />

          <select
            name="priority"
            className="select"
            value={formData.priority}
            onChange={handleChange}
          >
            <option value="low">
              Low
            </option>

            <option value="medium">
              Medium
            </option>

            <option value="high">
              High
            </option>
          </select>

          <button type="submit" className="btn">
            Add Task
          </button>
        </form>

        <div className="task-list">
          {tasks.map((task) => (
            <div
              key={task._id}
              className="task-card"
            >
              <h3>{task.title}</h3>

              <div className="task-meta">
                <p>{task.description}</p>
                <span className="badge">Priority: {task.priority}</span>
                <span className="badge">{task.completed ? "Completed" : "Pending"}</span>
                {task.dueDate && (
                  <span className="badge">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {!task.completed && (
                  <button
                    type="button"
                    onClick={() => markComplete(task._id)}
                    className="btn-secondary"
                  >
                    Mark Complete
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => deleteTask(task._id)}
                  className="btn-ghost"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Tasks;