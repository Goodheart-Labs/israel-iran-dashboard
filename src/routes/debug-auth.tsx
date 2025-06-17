import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/debug-auth")({
  component: DebugAuthPage,
});

function DebugAuthPage() {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  const isAdmin = useQuery(api.users.isAdmin);
  const currentUser = useQuery(api.users.current);

  const getTokenInfo = async () => {
    if (!isSignedIn) return;
    try {
      const token = await getToken({ template: "convex" });
      console.log("Convex JWT Token:", token);
      alert("Token logged to console");
    } catch (error) {
      console.error("Failed to get token:", error);
      alert("Failed to get token: " + error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Authentication Debug Info</h1>
      
      <div className="space-y-4">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Clerk Status</h2>
            <div className="space-y-2">
              <p>Loaded: {isLoaded ? "Yes" : "No"}</p>
              <p>Signed In: {isSignedIn ? "Yes" : "No"}</p>
              <p>User ID: {userId || "None"}</p>
              <p>Session ID: {sessionId || "None"}</p>
              <button 
                className="btn btn-sm btn-primary"
                onClick={() => void getTokenInfo()}
                disabled={!isSignedIn}
              >
                Get Convex Token
              </button>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Convex Status</h2>
            <div className="space-y-2">
              <p>Is Admin Query Result: {JSON.stringify(isAdmin)}</p>
              <p>Current User: {currentUser ? JSON.stringify(currentUser, null, 2) : "None"}</p>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Environment</h2>
            <div className="space-y-2">
              <p>Convex URL: {import.meta.env.VITE_CONVEX_URL}</p>
              <p>Clerk Key Present: {import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ? "Yes" : "No"}</p>
              <p>Clerk Key Prefix: {import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.substring(0, 7)}...</p>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Next Steps</h2>
            <div className="space-y-2">
              {!isSignedIn && <p>1. Sign in using the admin panel</p>}
              {isSignedIn && !isAdmin && <p>1. You're signed in but not admin. Update your user role in the database.</p>}
              {isSignedIn && isAdmin && <p>✅ Everything looks good! You should have admin access.</p>}
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6">
        <a href="/admin" className="btn btn-primary">Go to Admin Panel</a>
        <a href="/" className="btn btn-outline ml-2">Back to Home</a>
      </div>
    </div>
  );
}