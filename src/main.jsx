// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import { AppStateProvider } from "./context/AppStateContext.jsx";

// Global styles
import "./index.css";   // whatever you already have here
import "./styles.css";  // our new design system (we'll rewrite it next)

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppStateProvider>
      <App />
    </AppStateProvider>
  </React.StrictMode>
);
