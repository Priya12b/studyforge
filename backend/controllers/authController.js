const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const oauthStateCache = new Map();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const buildUserPayload = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    authProvider: user.authProvider,
    avatar: user.avatar,
});

const createToken = (user) => jwt.sign(
    {
        id: user._id,
    },
    process.env.JWT_SECRET,
    {
        expiresIn: "7d",
    }
);

const getRedirectUrl = (token, user, clientOrigin) => {
    const params = new URLSearchParams({
        token,
        user: JSON.stringify(buildUserPayload(user)),
    });

    const targetUrl = clientOrigin || FRONTEND_URL;
    return `${targetUrl}/auth/callback?${params.toString()}`;
};

const startOAuthFlow = (provider, clientOrigin) => {
    const state = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    oauthStateCache.set(state, { provider, clientOrigin, createdAt: Date.now() });

    return state;
};

const validateOAuthState = (state, provider) => {
    const cached = oauthStateCache.get(state);

    if (!cached || cached.provider !== provider) {
        throw new Error("Invalid OAuth state");
    }

    oauthStateCache.delete(state);
};

const findOrCreateOAuthUser = async ({
    authProvider,
    providerId,
    email,
    name,
    avatar = "",
}) => {
    let user = null;

    if (providerId) {
        user = await User.findOne({ providerId });
    }

    if (!user && email) {
        user = await User.findOne({ email });
    }

    if (user) {
        // Keep 'local' authProvider if the user registered locally first
        if (user.authProvider !== "local") {
            user.authProvider = authProvider;
        }
        user.providerId = providerId || user.providerId || "";
        user.avatar = avatar || user.avatar || "";

        if (name) {
            user.name = user.name || name;
        }

        await user.save();
        return user;
    }

    const fallbackName = name || (email ? email.split("@")[0] : "Student");
    const safeEmail = email || `${authProvider}_${providerId || Date.now()}@studyforge.local`;
    const randomPassword = await bcrypt.hash(`${safeEmail}_${Date.now()}`, 10);

    return User.create({
        name: fallbackName,
        email: safeEmail,
        password: randomPassword,
        authProvider,
        providerId: providerId || "",
        avatar,
    });
};

const exchangeGoogleCode = async (code) => {
    try {
        const response = await axios.post("https://oauth2.googleapis.com/token", new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            grant_type: "authorization_code",
        }), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        return response.data;
    } catch (err) {
        if (err.response && err.response.data) {
            console.error("Google token exchange failed:", err.response.data);
        } else {
            console.error("Google token exchange error:", err.message || err);
        }

        throw err;
    }
};

const fetchGoogleProfile = async (accessToken) => {
    const response = await axios.get("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    return response.data;
};


const registerUser = async (req, res) => {
    try {
        const name = (req.body.name || "").trim();
        const email = normalizeEmail(req.body.email || "");
        const password = req.body.password || "";

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required",
            });
        }

        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({
                message: "Please enter a valid email address",
            });
        }

        if (!PASSWORD_REGEX.test(password)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters and include one uppercase letter, one lowercase letter and one number",
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                message: "An account with this email already exists. Please log in instead.",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            authProvider: "local",
        });

        res.status(201).json({
            message: "User registered successfully",
            user: buildUserPayload(user),
        });
    } catch (error) {
        console.error("Register error:", error);

        // Duplicate key (email) or validation
        if (error.code === 11000) {
            return res.status(409).json({ message: "Email already registered" });
        }

        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({ message: "Validation failed", errors: messages });
        }

        res.status(500).json({
            message: "Server Error",
        });
    }
};


const loginUser = async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email || "");
        const password = req.body.password || "";

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({
                message: "Please enter a valid email address",
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                message: "Invalid credentials",
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            if (user.authProvider === "google") {
                return res.status(400).json({
                    message: "This account uses Google sign-in. Please continue with Google.",
                });
            }
            return res.status(400).json({
                message: "Invalid credentials",
            });
        }

        const token = createToken(user);

        res.status(200).json({
            message: "Login successful",
            token,
            user: buildUserPayload(user),
        });
    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Server Error",
        });
    }
};

const beginGoogleAuth = (req, res) => {
    const referer = req.headers.referer;
    let clientOrigin = FRONTEND_URL;
    if (referer) {
        try {
            clientOrigin = new URL(referer).origin;
        } catch (e) {
            console.error("Failed to parse referer URL:", e);
        }
    }
    const state = startOAuthFlow("google", clientOrigin);
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", process.env.GOOGLE_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("state", state);

    return res.redirect(authUrl.toString());
};


const googleCallback = async (req, res) => {
    let clientOrigin = FRONTEND_URL;
    try {
        const { code, state } = req.query;
        const cached = oauthStateCache.get(state);
        if (cached && cached.clientOrigin) {
            clientOrigin = cached.clientOrigin;
        }

        validateOAuthState(state, "google");

        const tokenData = await exchangeGoogleCode(code);
        const profile = await fetchGoogleProfile(tokenData.access_token);

        const user = await findOrCreateOAuthUser({
            authProvider: "google",
            providerId: profile.sub,
            email: profile.email,
            name: profile.name,
            avatar: profile.picture || "",
        });

        const token = createToken(user);
        const redirectUrl = getRedirectUrl(token, user, clientOrigin);
        console.log("Google OAuth - redirecting to:", redirectUrl);
        console.log("Google OAuth - token length:", token ? token.length : 0);
        return res.redirect(redirectUrl);
    } catch (error) {
        console.log(error);
        return res.redirect(`${clientOrigin}/login?error=google_oauth_failed`);
    }
};


const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({
            message: "Server Error",
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Name is required" });
        }
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { name: name.trim() },
            { new: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({ message: "Profile updated successfully", user });
    } catch (error) {
        console.error("[authController] updateProfile failed:", error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    beginGoogleAuth,
    googleCallback,
};