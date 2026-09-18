import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address: the page moved to /el-nino. Shared links keep their mode and anchor.
export const Route = createFileRoute("/elnino")({
  validateSearch: (search: Record<string, unknown>): { mode?: "review" } =>
    search.mode === "review" ? { mode: "review" } : {},
  beforeLoad: ({ search, location }) => {
    // TanStack Router handles its own redirect objects as navigation signals.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/el-nino", search, hash: location.hash, replace: true });
  },
});
