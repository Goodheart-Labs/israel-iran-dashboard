import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Github, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/maintenance")({
  component: MaintenancePage,
});

function MaintenancePage() {
  return (
    <div className="flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-2xl bg-base-100 shadow-xl mx-4">
        <div className="card-body text-center">
          <div className="flex justify-center mb-6">
            <AlertTriangle className="w-16 h-16 text-warning" />
          </div>

          <h1 className="text-3xl font-bold mb-4">
            Nathan's vibecoding is experiencing technical difficulties
          </h1>

          <p className="text-lg opacity-80 mb-6">
            The current probabilities shown on this site are incorrect due to
            API integration issues.
          </p>

          <p className="text-base opacity-70 mb-8">
            Feel free to help debug and fix the issues:
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://github.com/Zezo-Ai/israel-iran-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              <Github className="w-5 h-5 mr-2" />
              View on GitHub
            </a>

            <a href="/" className="btn btn-outline">
              Proceed to Site Anyway
              <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </div>

          <div className="divider my-8"></div>

          <div className="text-sm opacity-60">
            <p className="mb-2">Known issues:</p>
            <ul className="list-disc list-inside text-left max-w-md mx-auto">
              <li>Polymarket API returning 400 errors for historical data</li>
              <li>Current price updates showing NaN values</li>
              <li>Chart data has significant gaps</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
