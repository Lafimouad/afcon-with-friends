import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";

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
  const [message, setMessage] = useState("");

  const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;

  const supportReason = useMemo(() => {
    if (!window.isSecureContext) return "Notifications require HTTPS.";
    if (!("serviceWorker" in navigator)) return "Service workers are not supported.";
    if (!("PushManager" in window)) return "Push notifications are not supported.";
    return "";
  }, []);

  useEffect(() => {
    const init = async () => {
      if (supportReason) {
        setSupported(false);
        setMessage(supportReason);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register("/push-sw.js");
        const existing = await registration.pushManager.getSubscription();
        setSubscribed(!!existing);
      } catch (_err) {
        setSupported(false);
        setMessage("Failed to initialize notifications.");
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

      const registration = await navigator.serviceWorker.register("/push-sw.js");
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64ToUint8Array(vapidPublicKey),
        });
      }

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
      setMessage("Notifications enabled.");
    } catch (err) {
      setMessage(err.message || "Failed to enable notifications.");
    } finally {
      setLoading(false);
    }
  };

  const disableNotifications = async () => {
    if (!user) return;

    setLoading(true);
    setMessage("");

    try {
      const registration = await navigator.serviceWorker.register("/push-sw.js");
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
      setMessage(err.message || "Failed to disable notifications.");
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
      {message && <span className="notify-hint">{message}</span>}
    </div>
  );
}
