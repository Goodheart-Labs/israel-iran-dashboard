import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ExternalLink, Heart } from "lucide-react";

export const Route = createFileRoute("/")({
  component: MaintenancePage,
});

function MaintenancePage() {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto text-center">
        {/* Main Content */}
        <div className="mb-8">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-warning/20 rounded-full">
              <AlertTriangle className="w-16 h-16 text-warning" />
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Global Risk Odds
          </h1>

          <p className="text-xl md:text-2xl opacity-80 mb-6">
            We're experiencing some technical difficulties and the dashboard is
            temporarily offline.
          </p>

          <div className="bg-base-200 rounded-lg p-6 mb-8">
            <p className="text-lg mb-4">
              Our global risk prediction system is currently offline while we
              work to resolve data synchronization issues. We apologize for the
              inconvenience and appreciate your patience.
            </p>

            <p className="text-base opacity-70">
              This dashboard normally tracks real-time probabilities from
              prediction markets and forecasting platforms to provide insights
              into global risk events.
            </p>
          </div>
        </div>

        {/* Status Updates */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">What We're Working On</h2>
          <div className="space-y-3 text-left max-w-md mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-warning rounded-full"></div>
              <span>Data pipeline synchronization</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-warning rounded-full"></div>
              <span>Market probability calculations</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-warning rounded-full"></div>
              <span>Historical data accuracy</span>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://goodheartlabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              <Heart className="w-4 h-4 mr-2" />
              Goodheart Labs
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </div>

          <p className="text-sm opacity-60">
            A project by Nathan Young and the Goodheart Labs team
          </p>
        </div>

        {/* Footer Note */}
        <div className="mt-12 pt-8 border-t border-base-300">
          <p className="text-sm opacity-50">
            We hope to have the dashboard fully operational soon. Thank you for
            your understanding and continued support.
          </p>
        </div>
      </div>
    </div>
  );
}
