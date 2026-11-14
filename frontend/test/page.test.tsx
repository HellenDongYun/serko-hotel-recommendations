import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../app/page";

const originalMessage = "Find a Wellington hotel for two nights.";
const success = {
  message: "Synthetic fixture data: here are three demo hotel recommendations.",
  hotels: [{ id: "h1", name: "Harbour House", nightlyPrice: 220, currency: "NZD", breakfastIncluded: true, explanation: "Within budget; breakfast included." }],
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
    });
    await act(async () => resolve(json(success)));
    expect(await screen.findByText(success.message)).toBeVisible();
    expect(submit).toBeEnabled();
    expect(screen.queryByText("Finding demo recommendations…")).not.toBeInTheDocument();
  });

  it("renders the assistant message and a clear empty state", async () => {
    const { fetchMock, user, input, selector } = setup();
    fetchMock.mockResolvedValueOnce(json({ message: "Synthetic fixture data: no hotels found for this demo scenario.", hotels: [] }));
    await user.type(input, originalMessage);
    await user.selectOptions(selector, "empty");
    await user.click(screen.getByRole("button", { name: "Find hotels" }));
    expect(await screen.findByText("Synthetic fixture data: no hotels found for this demo scenario.")).toBeVisible();
    expect(screen.getByText(/No hotels found\. Try/)).toBeVisible();
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
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ message: originalMessage, scenario: "error" });
    // Editing the visible input must not change what Retry sends.
    await user.clear(input);
    await user.type(input, "An edited draft");
    await user.selectOptions(selector, "success");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string)).toEqual({ message: originalMessage, scenario: "success" });
    expect(await screen.findByText(success.message)).toBeVisible();
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
});
