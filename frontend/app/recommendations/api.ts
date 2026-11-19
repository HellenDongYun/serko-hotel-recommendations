import type { Hotel, Recommendations, Scenario } from "./types";

export const RECOMMENDATIONS_TIMEOUT_MS = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHotel(value: unknown): value is Hotel {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && typeof value.nightlyPrice === "number"
    && Number.isFinite(value.nightlyPrice)
    && typeof value.currency === "string"
    && typeof value.breakfastIncluded === "boolean"
    && typeof value.explanation === "string";
}

export async function fetchRecommendations(message: string, scenario: Scenario): Promise<Recommendations> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) throw new Error("API URL is missing. Set NEXT_PUBLIC_API_BASE_URL and restart the frontend.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECOMMENDATIONS_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/recommendations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, scenario }),
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch((error: unknown) => {
      // Malformed JSON is handled below. Let aborts and body transport failures propagate.
      if (error instanceof SyntaxError) return null;
      throw error;
    });
    if (!response.ok) {
      throw new Error(isRecord(body) && typeof body.detail === "string"
        ? body.detail
        : `Recommendations could not be loaded (HTTP ${response.status}). Please retry.`);
    }
    if (!isRecord(body) || typeof body.message !== "string"
      || !Array.isArray(body.hotels) || !body.hotels.every(isHotel)) {
      throw new Error("The recommendations API returned an invalid response. Please retry.");
    }
    return { message: body.message, hotels: body.hotels };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("The recommendations request timed out. Please retry.");
    }
    if (error instanceof TypeError) {
      throw new Error("Cannot reach the recommendations API. Check that it is running and retry.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
