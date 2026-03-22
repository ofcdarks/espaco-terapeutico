import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const saved = localStorage.getItem("theme");
if (saved === "light") document.documentElement.classList.remove("dark");
else document.documentElement.classList.add("dark");

// PWA
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
