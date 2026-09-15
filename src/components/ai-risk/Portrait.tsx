import { useState } from "react";
import type { PublicFigure } from "@/lib/ai-risk/types";

export function Portrait({ figure }: { figure: PublicFigure }) {
  const [failed, setFailed] = useState(false);
  return <span className="air-portrait">
    {figure.portrait.src && !failed
      ? <img src={figure.portrait.src} alt="" loading="lazy" onError={() => setFailed(true)} />
      : <span aria-hidden="true">{figure.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</span>}
  </span>;
}
