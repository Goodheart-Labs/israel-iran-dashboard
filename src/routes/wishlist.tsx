import { createFileRoute, Link } from "@tanstack/react-router";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/wishlist")({
  staticData: { title: "Requests" },
  component: WishlistPage,
});

function WishlistPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 prose prose-invert">
      <Link to="/" className="not-prose flex items-center gap-1.5 text-sm opacity-60 hover:opacity-100 mb-6 no-underline">
        <ArrowLeft className="w-4 h-4" />
        Back to dashboard
      </Link>

      <h1 className="text-2xl font-bold mb-1">Markets we'd like to see</h1>
      <p className="text-sm opacity-50 mb-0">
        These are questions that would make great prediction markets — but don't exist yet on Polymarket or Kalshi.
        Upvote the ones you want most. High-vote suggestions are much easier to pitch to market platforms.
      </p>

      <SuggestionsPanel standalone />
    </div>
  );
}
