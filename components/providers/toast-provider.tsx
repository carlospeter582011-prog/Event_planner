"use client";

import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: "#1e293b",
          color: "#f1f5f9",
          borderRadius: "8px",
          padding: "12px 16px",
          fontSize: "14px",
          maxWidth: "420px",
        },
        success: {
          iconTheme: { primary: "#22c55e", secondary: "#f1f5f9" },
        },
        error: {
          iconTheme: { primary: "#ef4444", secondary: "#f1f5f9" },
          duration: 5000,
        },
      }}
    />
  );
}
