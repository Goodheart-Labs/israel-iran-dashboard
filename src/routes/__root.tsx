import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
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
            <Outlet />
          </main>
        </div>
        {import.meta.env.DEV && <TanStackRouterDevtools />}
      </QueryClientProvider>
    </ConvexProvider>
  );
}