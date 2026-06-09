const Subscription = require("../models/Subscription");
const { sendPushNotification, vapidPublicKey } = require("../services/notificationService");

/**
 * Get VAPID Public Key for client subscription setup
 */
const getPublicKey = async (req, res) => {
  try {
    return res.status(200).json({
      publicKey: vapidPublicKey,
    });
  } catch (error) {
    console.error("[NotificationController] getPublicKey failed:", error.message);
    return res.status(500).json({ message: "Failed to get public key" });
  }
};

/**
 * Register a client subscription
 */
const subscribe = async (req, res) => {
  try {
    const { endpoint, keys, expirationTime } = req.body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ message: "Invalid subscription payload structure" });
    }

    // Check if subscription already exists for this endpoint
    let subscription = await Subscription.findOne({ endpoint });

    if (subscription) {
      // Update existing subscription
      subscription.userId = req.user.id;
      subscription.keys = keys;
      subscription.expirationTime = expirationTime;
      await subscription.save();
      console.log(`[NotificationController] Updated push subscription for user: ${req.user.id}`);
    } else {
      // Create new subscription
      subscription = await Subscription.create({
        userId: req.user.id,
        endpoint,
        expirationTime,
        keys,
      });
      console.log(`[NotificationController] Created new push subscription for user: ${req.user.id}`);
    }

    return res.status(201).json({
      success: true,
      message: "Subscription registered successfully",
      subscription,
    });
  } catch (error) {
    console.error("[NotificationController] subscribe failed:", error.message);
    return res.status(500).json({ message: "Subscription registration failed" });
  }
};

/**
 * Unsubscribe a client
 */
const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ message: "Endpoint is required to unsubscribe" });
    }

    const result = await Subscription.findOneAndDelete({
      endpoint,
      userId: req.user.id,
    });

    if (!result) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    console.log(`[NotificationController] Deleted push subscription for user: ${req.user.id}`);

    return res.status(200).json({
      success: true,
      message: "Unsubscribed successfully",
    });
  } catch (error) {
    console.error("[NotificationController] unsubscribe failed:", error.message);
    return res.status(500).json({ message: "Unsubscribe failed" });
  }
};

/**
 * Send a test notification to the logged-in user
 */
const sendTestNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const payload = {
      title: "StudyForge Test Alert 🚀",
      body: "Hooray! Real-time desktop push notifications are fully configured and functional.",
      icon: "/logo192.png", // fallback icons
      badge: "/badge.png",
      data: {
        url: "/dashboard",
      },
    };

    const result = await sendPushNotification(userId, payload);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: `Test notification sent successfully to ${result.sentCount} device(s).`,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.error || "No active subscriptions found. Enable notifications first.",
      });
    }
  } catch (error) {
    console.error("[NotificationController] sendTestNotification failed:", error.message);
    return res.status(500).json({ message: "Failed to send test notification" });
  }
};

module.exports = {
  getPublicKey,
  subscribe,
  unsubscribe,
  sendTestNotification,
};
