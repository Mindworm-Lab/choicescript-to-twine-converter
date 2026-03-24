import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Initialize activeSceneId
import { useProjectStore } from "./store/projectStore";
const state = useProjectStore.getState();
if (state.project.scenes.length > 0 && !state.activeSceneId) {
  useProjectStore.setState({ activeSceneId: state.project.scenes[0].id });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
