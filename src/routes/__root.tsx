import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import {
  ConvexReactClient,
  ConvexProvider,
} from "convex/react";
import { useEffect } from "react";
import { posthog } from "@/components/PostHogProvider";

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
    <nav className="max-w-7xl mx-auto mb-2">
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
        <div className="min-h-screen bg-base-200 text-base-content">
          <main className="flex-1 container mx-auto p-4 max-w-none">
            <TopicTabs />
            <Outlet />
          </main>
        </div>
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </QueryClientProvider>
    </ConvexProvider>
  );
}