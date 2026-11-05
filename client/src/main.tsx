import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";
import "./investigation-enhancements.css";

const root = document.getElementById("root");
if (!root) throw new Error("The application root element is missing.");
ReactDOM.createRoot(root).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
