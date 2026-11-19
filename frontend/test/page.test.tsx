import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../app/page";
import { RECOMMENDATIONS_TIMEOUT_MS } from "../app/recommendations/api";

const originalMessage = "Find a Wellington hotel for two nights.";
const success = {
  message: "Synthetic fixture data: here are three demo hotel recommendations.",
  hotels: [
    { id: "h1", name: "Harbour House", nightlyPrice: 220, currency: "NZD", breakfastIncluded: true, explanation: "Within budget; breakfast included." },
    { id: "h2", name: "City Garden", nightlyPrice: 245, currency: "NZD", breakfastIncluded: true, explanation: "Near the meeting district." },
    { id: "h3", name: "Quay Rooms", nightlyPrice: 195, currency: "NZD", breakfastIncluded: false, explanation: "Lower price; breakfast costs extra." },
  ],
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
function setup() {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  render(<Home />);
  return { fetchMock, user: userEvent.setup(), input: screen.getByRole("textbox", { name: "Your hotel request" }), selector: screen.getByRole("combobox", { name: "Demo scenario" }) };
}
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000"));

describe("recommendation request journey", () => {
  it("defaults to success and rejects whitespace without making a request", async () => {
    const { fetchMock, user, input, selector } = setup();
    expect(selector).toHaveValue("success");
    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: "Find hotels" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a message");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the configured URL and shows controlled pending progress without duplicate requests", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8123/");
    const { fetchMock, user, input, selector } = setup();
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    await user.type(input, originalMessage);
    const submit = screen.getByRole("button", { name: "Find hotels" });
    await user.click(submit);
    expect(screen.getByRole("status")).toHaveTextContent("Finding demo recommendations");
    expect(submit).toBeDisabled();
    expect(selector).toBeDisabled();
    await user.click(submit);
    // Exercise the guard even if a second submit event is dispatched directly.
    fireEvent.submit(submit.closest("form")!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8123/recommendations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: originalMessage, scenario: "success" }),
      signal: expect.any(AbortSignal),
    });
    await act(async () => resolve(json(success)));
    expect(await screen.findByText(success.message)).toBeVisible();
    expect(submit).toBeEnabled();
    expect(screen.queryByText("Finding demo recommendations…")).not.toBeInTheDocument();
  });

  it.each(["headers", "body"])("times out while waiting for %s and allows manual retry", async (phase) => {
    const { fetchMock, input } = setup();
    fetchMock.mockImplementationOnce(async (_url, options) => {
      const signal = options!.signal!;
      const pending = new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
      if (phase === "headers") return pending;
      const response = json(success);
      vi.spyOn(response, "json").mockReturnValue(pending);
      return response;
    }).mockResolvedValueOnce(json(success));

    vi.useFakeTimers();
    try {
      fireEvent.change(input, { target: { value: originalMessage } });
      fireEvent.click(screen.getByRole("button", { name: "Find hotels" }));
      await act(async () => vi.advanceTimersByTimeAsync(RECOMMENDATIONS_TIMEOUT_MS - 1));
      expect(screen.getByRole("status")).toHaveTextContent("Finding demo recommendations");
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
      expect(screen.getByRole("alert")).toHaveTextContent("timed out");
      expect(screen.queryByRole("article")).not.toBeInTheDocument();
      expect(input).toHaveValue(originalMessage);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry" })));
      expect(screen.getAllByRole("article")).toHaveLength(3);
      expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["malformed JSON", () => new Response("{", { status: 200 })],
    ["wrong top-level shape", () => json({ message: "Demo", hotels: null })],
    ["invalid hotel fields", () => json({
      ...success,
      hotels: [success.hotels[0], { ...success.hotels[1], nightlyPrice: "245" }],
    })],
  ] as const)("rejects a successful HTTP response with %s", async (_label, response) => {
    const { fetchMock, user, input } = setup();
    fetchMock.mockResolvedValueOnce(response());
    await user.type(input, originalMessage);
    await user.click(screen.getByRole("button", { name: "Find hotels" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("returned an invalid response");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(input).toHaveValue(originalMessage);
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("renders the assistant message and a clear empty state", async () => {
    const { fetchMock, user, input, selector } = setup();
    fetchMock.mockResolvedValueOnce(json({ message: "Synthetic fixture data: no hotels found for this demo scenario.", hotels: [] }));
    await user.type(input, originalMessage);
    await user.selectOptions(selector, "empty");
    await user.click(screen.getByRole("button", { name: "Find hotels" }));
    expect(await screen.findByText("Synthetic fixture data: no hotels found for this demo scenario.")).toBeVisible();
    expect(screen.getByText(/No hotels found\. Try/)).toBeVisible();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("preserves input after 503 and retries the original message with the current scenario", async () => {
    const { fetchMock, user, input, selector } = setup();
    const detail = "Synthetic fixture demo: recommendations are temporarily unavailable. Select Success and retry.";
    fetchMock.mockResolvedValueOnce(json({ detail }, 503)).mockResolvedValueOnce(json(success));
    await user.type(input, originalMessage);
    await user.selectOptions(selector, "error");
    await user.click(screen.getByRole("button", { name: "Find hotels" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
    expect(input).toHaveValue(originalMessage);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ message: originalMessage, scenario: "error" });
    // Editing the visible input must not change what Retry sends.
    await user.clear(input);
    await user.type(input, "An edited draft");
    await user.selectOptions(selector, "success");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({ message: originalMessage, scenario: "success" });
    expect(await screen.findByText(success.message)).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    for (const hotel of success.hotels) {
      expect(screen.getByRole("article", { name: hotel.name })).toBeVisible();
    }
    expect(input).toHaveValue("An edited draft");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps error selected on retry and never retries automatically", async () => {
    const { fetchMock, user, input, selector } = setup();
    fetchMock.mockImplementation(async () => json({ detail: "Demo unavailable" }, 503));
    await user.type(input, originalMessage);
    await user.selectOptions(selector, "error");
    await user.click(screen.getByRole("button", { name: "Find hotels" }));
    await screen.findByRole("alert");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Demo unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string).scenario).toBe("error");
  });

  it("handles a network failure with preserved input and manual retry", async () => {
    const { fetchMock, user, input } = setup();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await user.type(input, originalMessage);
    await user.click(screen.getByRole("button", { name: "Find hotels" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the recommendations API");
    expect(input).toHaveValue(originalMessage);
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("renders every hotel field and supports one selected hotel using keyboard controls", async () => {
    const { fetchMock, user, input } = setup();
    fetchMock.mockResolvedValueOnce(json(success));
    await user.type(input, originalMessage);
    await user.click(screen.getByRole("button", { name: "Find hotels" }));
    await screen.findByText(success.message);
    expect(screen.getByRole("heading", { name: "Hotel recommendations · Synthetic fixture data" })).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    for (const hotel of success.hotels) {
      const card = within(screen.getByRole("article", { name: hotel.name }));
      expect(card.getByRole("heading", { name: hotel.name })).toBeVisible();
      expect(card.getByText(`${hotel.currency} ${hotel.nightlyPrice.toFixed(2)} per night`)).toBeVisible();
      expect(card.getByText(hotel.breakfastIncluded ? "Breakfast included" : "Breakfast not included")).toBeVisible();
      expect(card.getByText(hotel.explanation)).toBeVisible();
      expect(card.getByRole("button", { name: `Select ${hotel.name}` })).toHaveAttribute("aria-pressed", "false");
    }
    await user.tab();
    expect(screen.getByRole("button", { name: "Select Harbour House" })).toHaveFocus();
    await user.keyboard("{Enter}");
    let summary = within(screen.getByRole("region", { name: "Your selected hotel" }));
    expect(summary.getByText("Harbour House")).toBeVisible();
    expect(summary.getByText("NZD 220.00 per night")).toBeVisible();
    expect(summary.getByText("Breakfast included")).toBeVisible();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Select Quay Rooms" })).toHaveFocus();
    await user.keyboard(" ");
    summary = within(screen.getByRole("region", { name: "Your selected hotel" }));
    expect(summary.getByText("Quay Rooms")).toBeVisible();
    expect(summary.getByText("NZD 195.00 per night")).toBeVisible();
    expect(summary.getByText("Breakfast not included")).toBeVisible();
    expect(summary.queryByText("Harbour House")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Harbour House" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Select Quay Rooms" })).toHaveAttribute("aria-pressed", "true");
  });

  it("clears the previous selection when a new request starts, even when the same hotels return", async () => {
    const { fetchMock, user, input } = setup();
    let resolve!: (response: Response) => void;
    fetchMock.mockResolvedValueOnce(json(success))
      .mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    await user.type(input, originalMessage);
    await user.click(screen.getByRole("button", { name: "Find hotels" }));
    await user.click(await screen.findByRole("button", { name: "Select City Garden" }));
    expect(screen.getByRole("region", { name: "Your selected hotel" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Find hotels" }));
    expect(screen.getByRole("status")).toHaveTextContent("Finding demo recommendations");
    expect(screen.queryByRole("region", { name: "Your selected hotel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    await act(async () => resolve(json(success)));
    expect(await screen.findAllByRole("article")).toHaveLength(3);
    expect(screen.queryByRole("region", { name: "Your selected hotel" })).not.toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: /^Select / })) {
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });
});
