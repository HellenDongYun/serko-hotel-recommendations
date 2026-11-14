"use client";

import { useRef, useState, type FormEvent } from "react";

type Scenario = "success" | "empty" | "error";
type Hotel = {
  id: string;
  name: string;
  nightlyPrice: number;
  currency: string;
  breakfastIncluded: boolean;
  explanation: string;
};
type Recommendations = { message: string; hotels: Hotel[] };
type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: Recommendations }
  | { status: "error"; message: string };

export default function Home() {
  const [message, setMessage] = useState("");
  const [scenario, setScenario] = useState<Scenario>("success");
  const [validation, setValidation] = useState("");
  const [state, setState] = useState<RequestState>({ status: "idle" });
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const lastSubmittedMessage = useRef<string | null>(null);
  const pending = useRef(false);
  const loading = state.status === "loading";
  const selectedHotel = state.status === "done"
    ? state.result.hotels.find((hotel) => hotel.id === selectedHotelId)
    : undefined;

  async function requestRecommendations(submittedMessage: string) {
    if (pending.current) return;
    pending.current = true;
    lastSubmittedMessage.current = submittedMessage;
    setValidation("");
    setSelectedHotelId(null);
    setState({ status: "loading" });
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!baseUrl) throw new Error("API URL is missing. Set NEXT_PUBLIC_API_BASE_URL and restart the frontend.");
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: submittedMessage, scenario }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(typeof error?.detail === "string"
          ? error.detail
          : `Recommendations could not be loaded (HTTP ${response.status}). Please retry.`);
      }
      const result: Recommendations = await response.json();
      setState({ status: "done", result });
    } catch (error) {
      setState({ status: "error", message: error instanceof TypeError
        ? "Cannot reach the recommendations API. Check that it is running and retry."
        : error instanceof Error ? error.message : "Recommendations could not be loaded. Please retry." });
    } finally {
      pending.current = false;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) {
      setValidation("Enter a message with at least one non-whitespace character.");
      return;
    }
    void requestRecommendations(message);
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-teal-800">Synthetic fixture demo</p>
      <h1 className="text-3xl font-bold sm:text-4xl">Find a hotel for your trip</h1>
      <p className="mt-4 leading-relaxed text-slate-600">Describe your stay. This demo uses local fixture data; the selected scenario determines the result.</p>

      <form onSubmit={submit} className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div>
          <label htmlFor="message" className="block font-semibold">Your hotel request</label>
          <p id="message-help" className="mt-1 text-sm text-slate-600">For example: Find a Wellington hotel for two nights, up to NZD 250 per night; breakfast preferred.</p>
          <textarea id="message" rows={4} value={message}
            onChange={(event) => { setMessage(event.target.value); setValidation(""); }}
            aria-describedby={validation ? "message-help message-error" : "message-help"}
            aria-invalid={Boolean(validation)}
            className="mt-3 w-full rounded-lg border border-slate-400 p-3" />
          {validation && <p id="message-error" role="alert" className="mt-2 text-red-800">{validation}</p>}
        </div>
        <div>
          <label htmlFor="scenario" className="block font-semibold">Demo scenario</label>
          <select id="scenario" value={scenario} disabled={loading}
            onChange={(event) => setScenario(event.target.value as Scenario)}
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

      <div role="status" aria-live="polite" className="mt-6">
        {loading && <p>Finding demo recommendations…</p>}
        {state.status === "done" && <section aria-label="Assistant response" className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-xl font-semibold">Assistant response</h2>
          <p className="mt-3">{state.result.message}</p>
          {state.result.hotels.length === 0 && <p className="mt-3 font-medium">No hotels found. Try another message or choose the Success demo scenario.</p>}
        </section>}
      </div>
      {state.status === "done" && state.result.hotels.length > 0 && (
        <section aria-labelledby="recommendations-heading" className="mt-6">
          <h2 id="recommendations-heading" className="text-xl font-semibold">Hotel recommendations · Synthetic fixture data</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {state.result.hotels.map((hotel) => (
              <article key={hotel.id} aria-labelledby={`hotel-${hotel.id}`}
                className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 break-words">
                <h3 id={`hotel-${hotel.id}`} className="text-xl font-semibold">{hotel.name}</h3>
                <p className="mt-3 font-semibold">{hotel.currency} {hotel.nightlyPrice.toFixed(2)} per night</p>
                <p className="mt-2">{hotel.breakfastIncluded ? "Breakfast included" : "Breakfast not included"}</p>
                <p className="mt-3 text-slate-600">{hotel.explanation}</p>
                <button type="button" aria-pressed={selectedHotelId === hotel.id}
                  onClick={() => setSelectedHotelId(hotel.id)}
                  className="mt-5 w-full rounded-lg border border-teal-800 px-4 py-3 font-semibold text-teal-900 aria-pressed:bg-teal-800 aria-pressed:text-white">
                  Select {hotel.name}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      <div aria-live="polite">
        {selectedHotel && <section aria-labelledby="selection-heading" className="mt-6 rounded-xl border border-teal-700 bg-teal-50 p-5 break-words">
          <h2 id="selection-heading" className="text-xl font-semibold">Your selected hotel</h2>
          <p className="mt-3 font-semibold">{selectedHotel.name}</p>
          <p className="mt-2">{selectedHotel.currency} {selectedHotel.nightlyPrice.toFixed(2)} per night</p>
          <p className="mt-2">{selectedHotel.breakfastIncluded ? "Breakfast included" : "Breakfast not included"}</p>
          <p className="mt-3 text-sm text-slate-600">Synthetic fixture selection. No booking has been made.</p>
        </section>}
      </div>
      {state.status === "error" && <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5" aria-label="Request failed">
        <p role="alert" className="text-red-900">{state.message}</p>
        <p className="mt-2 text-sm">Retry uses your last submitted message and the currently selected demo scenario.</p>
        <button type="button" onClick={() => {
          if (lastSubmittedMessage.current !== null) void requestRecommendations(lastSubmittedMessage.current);
        }} className="mt-4 rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white">Retry</button>
      </section>}
    </main>
  );
}
