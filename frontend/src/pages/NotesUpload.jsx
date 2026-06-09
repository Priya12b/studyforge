import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../services/api";

import "../styles/dashboard.css";

const NotesUpload = () => {
    const [file, setFile] = useState(null);
    const [result, setResult] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);

    // Notes List Pagination
    const [notes, setNotes] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loadingNotes, setLoadingNotes] = useState(false);

    const fetchNotes = async (pageNum = 1) => {
        try {
            setLoadingNotes(true);
            const res = await API.get(`/upload/notes?page=${pageNum}&limit=5`);
            if (res.data.success) {
                setNotes(res.data.notes || res.data.data || []);
                setTotalPages(res.data.totalPages || 1);
                setPage(res.data.page || 1);
            }
        } catch (err) {
            console.error("[NotesUpload] fetch notes failed:", err.message);
        } finally {
            setLoadingNotes(false);
        }
    };

    useEffect(() => {
        fetchNotes(1);
    }, []);

    const handleUpload = async () => {
        if (!file) {
            toast.error("Please select a PDF or an image to upload");
            return;
        }

        const formData = new FormData();
        formData.append("pdf", file);

        try {
            setUploading(true);
            setProgress(0);
            setError(null);

            const res = await API.post("/upload/pdf", formData, {
                onUploadProgress: (event) => {
                    if (event.total) {
                        setProgress(Math.round((event.loaded * 100) / event.total));
                    }
                },
            });

            if (res.data.success) {
                setResult(res.data.data);
                toast.success("Document uploaded and AI processed successfully!");
                setFile(null);
                fetchNotes(1);
            }
        } catch (err) {
            console.error("[NotesUpload] upload failed:", err.message);
            const errMsg = err.response?.data?.message || "Upload failed. Verify file limits.";
            setError(errMsg);
            toast.error(errMsg);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this note and its AI results?")) {
            return;
        }
        try {
            await API.delete(`/upload/${id}`);
            toast.success("Note deleted successfully");
            fetchNotes(page);
            if (result && result._id === id) {
                setResult(null);
            }
        } catch (err) {
            console.error("[NotesUpload] delete failed:", err.message);
            toast.error("Failed to delete note");
        }
    };

    return (
        <Layout>
            <div className="dashboard-shell">
                <section className="dashboard-hero">
                    <div>
                        <span className="eyebrow">Notes Intelligence (PDF & Images)</span>
                        <h1>AI Notes Upload & OCR</h1>
                        <p className="dashboard-copy">
                            Upload a PDF or an image (max 10MB) and generate an AI summary, quiz and study plan from your notes.
                        </p>
                    </div>
                </section>

                <section className="dashboard-panel" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 30 }}>
                    <div className="card">
                        <div className="notes-upload-row" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                            <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                className="input"
                                onChange={(e) => setFile(e.target.files[0] || null)}
                                style={{ flex: 1, minWidth: 200 }}
                            />

                            <button onClick={handleUpload} disabled={uploading} className="btn">
                                {uploading ? `Uploading ${progress}%` : "Upload Document"}
                            </button>
                        </div>

                        {uploading && (
                            <div style={{ marginTop: 16 }} className="progress">
                                <div style={{ width: `${progress}%`, height: 6, background: "var(--accent)", borderRadius: 3 }} />
                            </div>
                        )}

                        {file && (
                            <div style={{ marginTop: 12 }} className="muted">
                                Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                            </div>
                        )}

                        {error && (
                            <div className="error-card card" style={{ marginTop: 12 }}>
                                <p style={{ color: "var(--danger)" }}>{error}</p>
                            </div>
                        )}
                    </div>

                    {/* Loaded / Selected Note Results */}
                    {result && (
                        <div style={{ display: "grid", gap: 18 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h2>Currently Viewing: {result.title}</h2>
                                <button className="btn-secondary" onClick={() => setResult(null)}>Clear View</button>
                            </div>
                            <div>
                                <h3>Summary</h3>
                                <div className="card" style={{ marginTop: 12 }}>
                                    <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit" }}>{result.summary}</pre>
                                </div>
                            </div>

                            <div>
                                <h3>Generated Quiz Questions</h3>
                                <div className="grid" style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
                                    {Array.isArray(result.generatedQuiz) && result.generatedQuiz.map((q, idx) => (
                                        <div key={idx} className="card">
                                            <strong>{idx + 1}. {q.question}</strong>
                                            {q.options && (
                                                <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                                                    {q.options.map((o, i) => <li key={i}>{o}</li>)}
                                                </ul>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {result.generatedPlan?.study_plan && (
                                <div>
                                    <h3>Generated Study Plan</h3>
                                    <div className="grid" style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                                        {result.generatedPlan.study_plan.map((item, idx) => (
                                            <div key={idx} className="card">
                                                <strong>{item.day}</strong>
                                                <p className="muted" style={{ marginTop: 8 }}>{item.task}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notes Library */}
                    <div>
                        <h2>Your Notes Library</h2>
                        {loadingNotes ? (
                            <LoadingSpinner message="Loading notes list..." />
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                                {notes.length === 0 ? (
                                    <p className="muted">No uploaded notes yet.</p>
                                ) : (
                                    notes.map((note) => (
                                        <div key={note._id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                                            <div>
                                                <h4 style={{ margin: 0 }}>{note.title}</h4>
                                                <span className="muted" style={{ fontSize: "0.8rem" }}>
                                                    Uploaded: {new Date(note.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <button className="btn btn-secondary" onClick={() => setResult(note)}>
                                                    View AI Output
                                                </button>
                                                <button className="btn" style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)" }} onClick={() => handleDelete(note._id)}>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
                                        <button
                                            className="btn btn-secondary"
                                            disabled={page === 1}
                                            onClick={() => fetchNotes(page - 1)}
                                        >
                                            Previous
                                        </button>
                                        <span>Page {page} of {totalPages}</span>
                                        <button
                                            className="btn btn-secondary"
                                            disabled={page === totalPages}
                                            onClick={() => fetchNotes(page + 1)}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </Layout>
    );
};

export default NotesUpload;