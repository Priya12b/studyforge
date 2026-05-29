/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";

import Layout from "../components/Layout";
import API from "../services/api";
import "../styles/attendance.css";

const Attendance = () => {
    const [status, setStatus] = useState("present");
    const [note, setNote] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadAttendance = async () => {
        try {
            const res = await API.get("/attendance/me");
            setData(res.data.data);
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        loadAttendance();
    }, []);

    const submitAttendance = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await API.post("/attendance/mark", { status, note });
            setNote("");
            await loadAttendance();
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="attendance-shell">
                <section className="attendance-hero">
                    <span className="eyebrow">Student Attendance</span>
                    <h1>Daily check-ins and weekly streaks</h1>
                    <p className="muted">
                        Mark your study presence, track consistency and keep your learning rhythm visible.
                    </p>
                </section>

                <div className="attendance-grid">
                    <form className="card attendance-form" onSubmit={submitAttendance}>
                        <h2>Mark today</h2>

                        <label className="field-block">
                            <span>Status</span>
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                                <option value="present">Present</option>
                                <option value="late">Late</option>
                                <option value="absent">Absent</option>
                            </select>
                        </label>

                        <label className="field-block">
                            <span>Note</span>
                            <textarea
                                className="input"
                                rows="4"
                                placeholder="Optional note about today’s study session"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                            />
                        </label>

                        <button className="btn" type="submit" disabled={loading}>
                            {loading ? "Saving..." : "Save attendance"}
                        </button>
                    </form>

                    <section className="card attendance-summary">
                        <h2>Summary</h2>
                        <div className="attendance-stats">
                            <div><strong>{data?.summary?.totalDays || 0}</strong><span>Total days</span></div>
                            <div><strong>{data?.summary?.presentDays || 0}</strong><span>Present</span></div>
                            <div><strong>{data?.summary?.lateDays || 0}</strong><span>Late</span></div>
                            <div><strong>{data?.summary?.absentDays || 0}</strong><span>Absent</span></div>
                            <div><strong>{data?.summary?.streak || 0}</strong><span>Current streak</span></div>
                        </div>

                        <div className="attendance-today">
                            <span className="stat-label">Today</span>
                            <strong>{data?.today ? data.today.status : "Not marked yet"}</strong>
                        </div>
                    </section>
                </div>

                <section className="card attendance-history">
                    <div className="section-head">
                        <h2>Recent activity</h2>
                    </div>

                    <div className="attendance-list">
                        {(data?.summary?.recentRecords || []).map((record) => (
                            <div key={record._id} className="attendance-row">
                                <div>
                                    <strong>{new Date(record.attendanceDate).toLocaleDateString()}</strong>
                                    <p className="muted">{record.note || "No note added"}</p>
                                </div>
                                <span className={`status-pill status-${record.status}`}>{record.status}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </Layout>
    );
};

export default Attendance;