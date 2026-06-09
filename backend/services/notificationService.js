const webpush = require("web-push");
const Subscription = require("../models/Subscription");

// Retrieve keys from environment or generate them on the fly
let vapidPublic = process.env.VAPID_PUBLIC_KEY;
let vapidPrivate = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublic || !vapidPrivate) {
  console.log("[NotificationService] VAPID keys not configured in .env. Generating temp keys...");
  const keys = webpush.generateVAPIDKeys();
  vapidPublic = keys.publicKey;
  vapidPrivate = keys.privateKey;
  console.log(`[NotificationService] Generated Keys for current run:
VAPID_PUBLIC_KEY=${vapidPublic}
VAPID_PRIVATE_KEY=${vapidPrivate}
(Add these keys to your backend .env file to persist them!)`);
}

webpush.setVapidDetails(
  "mailto:support@studyforge.com",
  vapidPublic,
  vapidPrivate
);

/**
 * Send push notification to a specific user
 * @param {string} userId - ID of the user
 * @param {object} payload - Notification payload { title, body, icon, data, ... }
 */
const sendPushNotification = async (userId, payload) => {
  try {
    const subscriptions = await Subscription.find({ userId });
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[NotificationService] No subscriptions found for user: ${userId}`);
      return { success: false, sentCount: 0 };
    }

    console.log(`[NotificationService] Sending notification to ${subscriptions.length} device(s) for user: ${userId}`);
    
    const notificationPromises = subscriptions.map((sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      };

      return webpush
        .sendNotification(pushSubscription, JSON.stringify(payload))
        .catch(async (error) => {
          // If subscription has expired or is invalid, remove it
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`[NotificationService] Subscription expired (status ${error.statusCode}). Deleting subscription: ${sub._id}`);
            await Subscription.findByIdAndDelete(sub._id);
          } else {
            console.error(`[NotificationService] Error sending to subscription: ${sub._id}`, error.message);
          }
        });
    });

    await Promise.all(notificationPromises);
    return { success: true, sentCount: subscriptions.length };
  } catch (error) {
    console.error("[NotificationService] sendPushNotification failed:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send push notification to all subscribed users
 * @param {object} payload - Notification payload
 */
const sendBroadcastNotification = async (payload) => {
  try {
    const subscriptions = await Subscription.find({});
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log("[NotificationService] No subscriptions registered in database.");
      return { success: false, sentCount: 0 };
    }

    console.log(`[NotificationService] Broadcasting notification to ${subscriptions.length} devices.`);

    const notificationPromises = subscriptions.map((sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      };

      return webpush
        .sendNotification(pushSubscription, JSON.stringify(payload))
        .catch(async (error) => {
          if (error.statusCode === 410 || error.statusCode === 404) {
            await Subscription.findByIdAndDelete(sub._id);
          }
        });
    });

    await Promise.all(notificationPromises);
    return { success: true, sentCount: subscriptions.length };
  } catch (error) {
    console.error("[NotificationService] sendBroadcastNotification failed:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Scan database for incomplete tasks due within the next 24 hours
 * and send web push alerts to their owners.
 */
const checkUpcomingTasksAndNotify = async () => {
  try {
    const Task = require("../models/Task");
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find all incomplete tasks due in the next 24 hours
    const tasks = await Task.find({
      completed: false,
      dueDate: { $gte: now, $lte: tomorrow },
    });

    console.log(`[NotificationService] Found ${tasks.length} upcoming tasks due soon. Checking subscriptions...`);

    let sentCount = 0;
    for (const task of tasks) {
      const result = await sendPushNotification(task.userId, {
        title: "StudyForge Task Alert ⏰",
        body: `Your task "${task.title}" is due by ${new Date(task.dueDate).toLocaleDateString()}. Make sure to complete it!`,
        icon: "/logo192.png",
        badge: "/badge.png",
        data: {
          url: "/tasks",
        },
      });
      if (result.success && result.sentCount > 0) {
        sentCount++;
      }
    }
    console.log(`[NotificationService] Successfully sent reminders for ${sentCount} tasks.`);
  } catch (error) {
    console.error("[NotificationService] Scheduled task check failed:", error.message);
  }
};

module.exports = {
  vapidPublicKey: vapidPublic,
  sendPushNotification,
  sendBroadcastNotification,
  checkUpcomingTasksAndNotify,
};
