import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installDomMutationGuard } from "./lib/domMutationGuard";

installDomMutationGuard();

createRoot(document.getElementById("root")!).render(<App />);
