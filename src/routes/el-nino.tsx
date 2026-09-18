import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias: the page lives at /elnino, but people type the hyphen.
export const Route = createFileRoute("/el-nino")({
  beforeLoad: () => {
    // TanStack Router handles its own redirect objects as navigation signals.
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/elnino", replace: true });
  },
});
