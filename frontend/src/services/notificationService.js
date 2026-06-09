import API from "./api";

/**
 * Helper to convert url-safe base64 string to Uint8Array for push manager VAPID key
 */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if browser supports Service Workers and Push Notifications
 */
export const isPushSupported = () => {
  return "serviceWorker" in navigator && "PushManager" in window;
};

/**
 * Get current notification permission and active subscription if any
 */
export const getNotificationState = async () => {
  if (!isPushSupported()) {
    return { supported: false, permission: "denied", subscribed: false };
  }

  const permission = Notification.permission;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  return {
    supported: true,
    permission,
    subscribed: !!subscription,
    subscription,
  };
};

/**
 * Register service worker and subscribe user to Web Push
 */
export const subscribeToNotifications = async () => {
  if (!isPushSupported()) {
    throw new Error("Push notifications not supported on this browser.");
  }

  // Request browser permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission denied.");
  }

  // Register service worker
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });
  
  // Wait for service worker to become active
  await navigator.serviceWorker.ready;

  // Fetch VAPID public key from backend
  const keyResponse = await API.get("/notifications/key");
  const vapidPublicKey = keyResponse.data.publicKey;
  if (!vapidPublicKey) {
    throw new Error("Failed to retrieve VAPID public key from server.");
  }

  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

  // Subscribe using PushManager
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    });
  }

  // Send subscription object to backend to register
  await API.post("/notifications/subscribe", subscription);

  return subscription;
};

/**
 * Unsubscribe user from notifications
 */
export const unsubscribeFromNotifications = async () => {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    // Unsubscribe on browser side
    await subscription.unsubscribe();

    // Call backend to remove subscription
    await API.post("/notifications/unsubscribe", {
      endpoint: subscription.endpoint,
    });
  }
};

/**
 * Trigger a test notification from server
 */
export const sendTestPushNotification = async () => {
  const response = await API.post("/notifications/test");
  return response.data;
};
