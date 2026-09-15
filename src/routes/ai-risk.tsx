import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { AiRiskPage } from "@/components/ai-risk/AiRiskPage";

export const Route = createFileRoute("/ai-risk")({
  staticData: { title: "AI risk explorer" },
  loader: async () => {
    const response = await fetch("/ai-risk-session", { credentials: "same-origin", cache: "no-store" });
    if (response.status === 401) {
      // TanStack Router handles its own redirect objects as navigation signals.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ href: "/ai-risk-access", reloadDocument: true });
    }
    if (!response.ok) throw new Error("The AI risk page is temporarily unavailable. Please try again shortly.");
    const result = await response.json() as { accessToken?: unknown };
    if (typeof result.accessToken !== "string") throw new Error("Please open this page through Global Risk Odds to enter the password.");
    return { accessToken: result.accessToken };
  },
  component: AiRiskRoute,
});

function AiRiskRoute() {
  const { accessToken } = Route.useLoaderData();
  useEffect(() => {
    const encoded = accessToken.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(encoded)) as { exp: number };
    const timeout = window.setTimeout(() => window.location.assign("/ai-risk-access"), Math.max(0, exp * 1000 - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [accessToken]);
  return <AiRiskPage accessToken={accessToken} />;
}
