import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "../shared/theme.css";
import { BoardApp } from "./App";

function Root() {
  const start = useMemo(() => new URLSearchParams(window.location.search).get("view") === "tv", []);
  const [tv, setTv] = useState(start);
  return (
    <BoardApp
      tv={tv}
      onTv={(on) => {
        setTv(on);
        const u = new URL(window.location.href);
        if (on) u.searchParams.set("view", "tv");
        else u.searchParams.delete("view");
        history.replaceState(null, "", u);
      }}
      homeHref="./index.html"
    />
  );
}

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
