import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";

function getErrorMessage(err) {
  if (!err) return "Unknown error.";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  return JSON.stringify(err);
}

function base64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}

export default function NotificationToggle() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  const registerServiceWorker = async () => {
    const response = await fetch("/push-sw.js", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`push-sw.js not reachable (HTTP ${response.status}).`);
    }

    const registration = await navigator.serviceWorker.register("/push-sw.js");
    await navigator.serviceWorker.ready;
    return registration;
  };

  const supportReason = useMemo(() => {
    if (!window.isSecureContext) return "Notifications require HTTPS.";
    if (!("serviceWorker" in navigator)) return "Service workers are not supported.";
    if (isIOS && !isStandalone) {
      return "On iPhone, push notifications work only after Add to Home Screen and opening the app from the Home Screen icon.";
    }
    if (!("PushManager" in window)) return "Push notifications are not supported.";
    return "";
  }, [isIOS, isStandalone]);

  useEffect(() => {
    const init = async () => {
      if (supportReason) {
        setSupported(false);
        setMessage(supportReason);
        return;
      }

      try {
        const registration = await registerServiceWorker();
        const existing = await registration.pushManager.getSubscription();
        setSubscribed(!!existing);
      } catch (err) {
        setSupported(false);
        setMessage(`Failed to initialize notifications: ${getErrorMessage(err)}`);
      }
    };

    init();
  }, [supportReason]);

  const enableNotifications = async () => {
    if (!user) return;
    if (!vapidPublicKey) {
      setMessage("Missing REACT_APP_VAPID_PUBLIC_KEY.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Notification permission was not granted.");
        return;
      }

      const registration = await registerServiceWorker();
      const existingSubscription = await registration.pushManager.getSubscription();

      // Refresh existing subscriptions to avoid stale endpoints and VAPID key drift.
      if (existingSubscription) {
        const existingEndpoint = existingSubscription.endpoint;
        await existingSubscription.unsubscribe();

        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", existingEndpoint);
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8Array(vapidPublicKey),
      });

      const json = subscription.toJSON();
      const { p256dh, auth } = json.keys || {};

      if (!json.endpoint || !p256dh || !auth) {
        throw new Error("Invalid push subscription payload.");
      }

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
        },
        { onConflict: "user_id,endpoint" },
      );

      if (error) throw error;

      setSubscribed(true);
      setMessage("Notifications enabled and subscription refreshed.");
    } catch (err) {
      setMessage(`Failed to enable notifications: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setTesting(true);
    setMessage("");

    try {
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        throw new Error("Notification permission is not granted.");
      }

      const registration = await registerServiceWorker();
      await registration.showNotification("Test notification", {
        body: "If you can see this, browser notifications work on this device.",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: { url: "/" },
      });

      setMessage("Test notification sent locally.");
    } catch (err) {
      setMessage(`Failed to send test notification: ${getErrorMessage(err)}`);
    } finally {
      setTesting(false);
    }
  };

  const disableNotifications = async () => {
    if (!user) return;

    setLoading(true);
    setMessage("");

    try {
      const registration = await registerServiceWorker();
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        const { error } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", endpoint);

        if (error) throw error;
      }

      setSubscribed(false);
      setMessage("Notifications disabled.");
    } catch (err) {
      setMessage(`Failed to disable notifications: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return <span className="notify-hint">{message}</span>;
  }

  return (
    <div className="notify-controls">
      <button
        className="btn-secondary btn-notify"
        onClick={subscribed ? disableNotifications : enableNotifications}
        disabled={loading}
        type="button"
      >
        {loading
          ? "Please wait..."
          : subscribed
            ? "Disable Notifications"
            : "Enable Notifications"}
      </button>
      <button
        className="btn-secondary btn-notify"
        onClick={sendTestNotification}
        disabled={testing || !supported}
        type="button"
      >
        {testing ? "Testing..." : "Send Test Notification"}
      </button>
      {message && <span className="notify-hint">{message}</span>}
    </div>
  );
}
