import { useState } from "react";
import Layout from "../components/Layout";

import API from "../services/api";

import "../styles/dashboard.css";

const NotesUpload = () => {
    const [file, setFile] = useState(null);
    const [result, setResult] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleUpload = async () => {
        if (!file) {
            alert("Please select a PDF to upload");
            return;
        }

        const formData = new FormData();
        formData.append("pdf", file);

        try {
            setUploading(true);
            setProgress(0);

            const res = await API.post("/upload/pdf", formData, {
                onUploadProgress: (event) => {
                    if (event.total) {
                        setProgress(Math.round((event.loaded * 100) / event.total));
                    }
                },
            });

            setResult(res.data.data);
        } catch (error) {
            console.log(error);
            alert("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    return (
        <Layout>
            <div className="dashboard-shell">
                <section className="dashboard-hero">
                    <div>
                        <span className="eyebrow">PDF Notes Intelligence</span>
                        <h1>AI Notes Upload</h1>
                        <p className="dashboard-copy">
                            Upload a PDF and generate an AI summary, quiz and study plan from your notes.
                        </p>
                    </div>
                </section>

                <section className="dashboard-panel">
                    <div className="notes-upload-row">
                        <input
                            type="file"
                            accept=".pdf"
                            className="input"
                            onChange={(e) => setFile(e.target.files[0] || null)}
                        />

                        <button onClick={handleUpload} disabled={uploading} className="btn">
                            {uploading ? `Uploading ${progress}%` : "Upload PDF"}
                        </button>
                    </div>

                    <div style={{ marginTop: 16 }} className="progress">
                        <div style={{ width: `${progress}%` }} />
                    </div>

                    {file && (
                        <div style={{ marginTop: 12 }} className="muted">
                            Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                        </div>
                    )}

                    {result && (
                        <div style={{ marginTop: 28, display: "grid", gap: 18 }}>
                            <div>
                                <h2>Summary</h2>
                                <div className="card" style={{ marginTop: 12 }}>
                                    <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{result.summary}</pre>
                                </div>
                            </div>

                            <div>
                                <h2>Generated Quiz</h2>
                                <div className="grid" style={{ marginTop: 12 }}>
                                    {Array.isArray(result.generatedQuiz) && result.generatedQuiz.map((q, idx) => (
                                        <div key={idx} className="card">
                                            <strong>{idx + 1}. {q.question}</strong>
                                            {q.options && (
                                                <ul>
                                                    {q.options.map((o, i) => <li key={i}>{o}</li>)}
                                                </ul>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {result.generatedPlan?.study_plan && (
                                <div>
                                    <h2>Generated Study Plan</h2>
                                    <div className="grid" style={{ marginTop: 12 }}>
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
                </section>
            </div>
        </Layout>
    );
};

export default NotesUpload;