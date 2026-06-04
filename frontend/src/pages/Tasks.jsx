import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../services/api";

import "../styles/tasks.css";

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "medium",
  });

  const fetchTasks = async (p = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await API.get(`/tasks?page=${p}&limit=5`);
      if (res.data.success) {
        setTasks(res.data.tasks);
        setPage(res.data.page);
        setTotalPages(res.data.totalPages);
      } else {
        // Fallback for non-paginated arrays
        setTasks(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error("[Tasks] Fetch failed:", err.message);
      setError("Failed to fetch tasks. Please try again.");
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks(1);
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const createTask = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Please enter a title and description");
      return;
    }

    try {
      setLoading(true);
      await API.post("/tasks", formData);
      toast.success("Task Created");
      setFormData({
        title: "",
        description: "",
        dueDate: "",
        priority: "medium",
      });
      fetchTasks(1);
    } catch (err) {
      console.error("[Tasks] Create failed:", err.message);
      toast.error("Could not create task");
    } finally {
      setLoading(false);
    }
  };

  const markComplete = async (id) => {
    try {
      setLoading(true);
      await API.put(`/tasks/${id}`, { completed: true });
      toast.success("Task marked complete");
      fetchTasks(page);
    } catch (err) {
      console.error("[Tasks] Update failed:", err.message);
      toast.error("Could not update task");
      setLoading(false);
    }
  };

  const deleteTask = async (id) => {
    if (!window.confirm("Are you sure you want to delete this task?")) {
      return;
    }
    try {
      setLoading(true);
      await API.delete(`/tasks/${id}`);
      toast.success("Task deleted");
      fetchTasks(page);
    } catch (err) {
      console.error("[Tasks] Delete failed:", err.message);
      toast.error("Could not delete task");
      setLoading(false);
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
            required
          />

          <input
            type="text"
            name="description"
            placeholder="Description"
            className="input"
            value={formData.description}
            onChange={handleChange}
            required
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
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <button type="submit" className="btn" disabled={loading}>
            Add Task
          </button>
        </form>

        {loading && <LoadingSpinner message="Updating task list..." />}

        {error && (
          <div className="error-card card">
            <p>{error}</p>
            <button className="btn-secondary" onClick={() => fetchTasks(page)}>Retry</button>
          </div>
        )}

        {!loading && (
          <>
            <div className="task-list">
              {tasks.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center" }} className="muted">
                  No tasks found for this view. Create one above!
                </div>
              ) : (
                tasks.map((task) => (
                  <div key={task._id} className="task-card">
                    <h3>{task.title}</h3>
                    <div className="task-meta">
                      <p>{task.description}</p>
                      <span className="badge">Priority: {task.priority}</span>
                      <span className="badge">{task.completed ? "Completed" : "Pending"}</span>
                      {task.dueDate && (
                        <span className="badge">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
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
                        style={{ color: "var(--danger)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 24 }}>
                <button
                  className="btn btn-secondary"
                  disabled={page === 1}
                  onClick={() => fetchTasks(page - 1)}
                >
                  Previous
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  className="btn btn-secondary"
                  disabled={page === totalPages}
                  onClick={() => fetchTasks(page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Tasks;