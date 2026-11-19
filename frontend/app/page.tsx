"use client";

import { useRef, useState, type FormEvent } from "react";

import { HotelRequestForm } from "./recommendations/HotelRequestForm";
import { RecommendationResults } from "./recommendations/RecommendationResults";
import { fetchRecommendations, type Scenario } from "../lib/api";
import type { RequestState } from "./recommendations/types";

export default function Home() {
  const [message, setMessage] = useState("");
  const [scenario, setScenario] = useState<Scenario>("success");
  const [validation, setValidation] = useState("");
  const [state, setState] = useState<RequestState>({ status: "idle" });
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const lastSubmittedMessage = useRef<string | null>(null);
  const pending = useRef(false);
  const loading = state.status === "loading";

  async function requestRecommendations(submittedMessage: string) {
    if (pending.current) return;
    pending.current = true;
    lastSubmittedMessage.current = submittedMessage;
    setValidation("");
    setSelectedHotelId(null);
    setState({ status: "loading" });
    try {
      const result = await fetchRecommendations(submittedMessage, scenario);
      setState({ status: "done", result });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Recommendations could not be loaded. Please retry.",
      });
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

      <HotelRequestForm
        message={message}
        scenario={scenario}
        validation={validation}
        loading={loading}
        onMessageChange={(value) => {
          setMessage(value);
          setValidation("");
        }}
        onScenarioChange={setScenario}
        onSubmit={submit}
      />
      <RecommendationResults
        state={state}
        selectedHotelId={selectedHotelId}
        onSelectHotel={setSelectedHotelId}
        onRetry={() => {
          if (lastSubmittedMessage.current !== null) void requestRecommendations(lastSubmittedMessage.current);
        }}
      />
    </main>
  );
}
