import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { useEffect } from "react";
import { posthog } from "@/components/PostHogProvider";
import { ChartVisibility } from "@/components/VotedCard";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexClient: ConvexReactClient;
}>()({
  component: RootComponent,
});

const TABS = [
  { to: "/", label: "Iran" },
  { to: "/ipo", label: "AI IPOs" },
  { to: "/wishlist", label: "Requests" },
] as const;

function TopicTabs() {
  return (
    <nav aria-label="Topics" className="max-w-7xl mx-auto mb-2">
      <div role="tablist" className="tabs tabs-border">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            role="tab"
            className="tab"
            activeProps={{ className: "tab tab-active" }}
            activeOptions={{ exact: tab.to === "/" }}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function RootComponent() {
  const { queryClient, convexClient: convex } = Route.useRouteContext();
  const location = useRouterState({ select: (s) => s.location });

  useEffect(() => {
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [location.pathname, location.search]);

  return (
    <ConvexProvider client={convex}>
      <QueryClientProvider client={queryClient}>
        <div className="risk-publication min-h-screen bg-base-200 text-base-content">
          <header className="risk-masthead">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-6">
              <Link
                to="/"
                className="risk-wordmark"
                aria-label="Global Risk Odds home"
              >
                <span className="risk-mark" aria-hidden="true">
                  ↗
                </span>
                <span>
                  GLOBAL RISK <strong>ODDS</strong>
                </span>
              </Link>
              <span className="hidden text-xs tracking-wide opacity-70 sm:block">
                The world, in probabilities.
              </span>
            </div>
          </header>
          <main className="flex-1 container mx-auto p-4 max-w-none">
            <TopicTabs />
            <ChartVisibility key={location.pathname}>
              <Outlet />
            </ChartVisibility>
          </main>
        </div>
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </QueryClientProvider>
    </ConvexProvider>
  );
}
