import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";

import { AuthContext } from "../context/AuthContext";
import { useContext } from "react";

const OAuthCallback = () => {
    const { setAuthFromQuery } = useContext(AuthContext);
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const token = params.get("token");
        const user = params.get("user");
        const error = params.get("error");

        if (error === "google_oauth_failed") {
            toast.error("Google sign-in failed. Please try again.");
            window.location.replace("/login");
            return;
        }

        if (!token || !user) {
            window.location.replace("/login");
            return;
        }

        try {
            setAuthFromQuery(token, JSON.parse(user));
            window.location.replace("/dashboard");
        } catch (callbackError) {
            console.log(callbackError);
            toast.error("Could not complete Google sign-in.");
            window.location.replace("/login");
        }
    }, [location.search, setAuthFromQuery]);

    return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
            <div className="surface" style={{ padding: 24, textAlign: "center" }}>
                <h2>Signing you in...</h2>
                <p className="muted">Please wait while we open your dashboard.</p>
            </div>
        </div>
    );
};

export default OAuthCallback;