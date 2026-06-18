import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { StartClient } from "@tanstack/react-start/client";

import { getRouter } from "./router";

declare global {
  interface Window {
    $_TSR?: unknown;
  }
}

startTransition(async () => {
  if (window.$_TSR) {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
    return;
  }

  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Elemento #root não encontrado para iniciar o app.");
  }

  const router = getRouter();
  await router.load();

  createRoot(container).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
});