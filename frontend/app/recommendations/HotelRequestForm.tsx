import type { FormEvent } from "react";
import type { Scenario } from "./types";

type Props = {
  message: string;
  scenario: Scenario;
  validation: string;
  loading: boolean;
  onMessageChange: (message: string) => void;
  onScenarioChange: (scenario: Scenario) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function HotelRequestForm({
  message, scenario, validation, loading, onMessageChange, onScenarioChange, onSubmit,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <div>
        <label htmlFor="message" className="block font-semibold">Your hotel request</label>
        <p id="message-help" className="mt-1 text-sm text-slate-600">For example: Find a Wellington hotel for two nights, up to NZD 250 per night; breakfast preferred.</p>
        <textarea id="message" rows={4} value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          aria-describedby={validation ? "message-help message-error" : "message-help"}
          aria-invalid={Boolean(validation)}
          className="mt-3 w-full rounded-lg border border-slate-400 p-3" />
        {validation && <p id="message-error" role="alert" className="mt-2 text-red-800">{validation}</p>}
      </div>
      <div>
        <label htmlFor="scenario" className="block font-semibold">Demo scenario</label>
        <select id="scenario" value={scenario} disabled={loading}
          onChange={(event) => onScenarioChange(event.target.value as Scenario)}
          aria-describedby="scenario-help"
          className="mt-2 w-full rounded-lg border border-slate-400 bg-white p-3 sm:w-60">
          <option value="success">Success</option>
          <option value="empty">Empty</option>
          <option value="error">Error</option>
        </select>
        <p id="scenario-help" className="mt-2 text-sm text-slate-600">Success returns three fixtures. Empty returns none. Error always returns HTTP 503.</p>
      </div>
      <button type="submit" disabled={loading} className="w-full rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto">Find hotels</button>
    </form>
  );
}
