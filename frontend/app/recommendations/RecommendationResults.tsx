import { HotelCard } from "./HotelCard";
import type { RequestState } from "./types";

type Props = {
  state: RequestState;
  selectedHotelId: string | null;
  onSelectHotel: (hotelId: string) => void;
  onRetry: () => void;
};

export function RecommendationResults({
  state, selectedHotelId, onSelectHotel, onRetry,
}: Props) {
  const selectedHotel = state.status === "done"
    ? state.result.hotels.find((hotel) => hotel.id === selectedHotelId)
    : undefined;

  return (
    <>
      <div role="status" aria-live="polite" className="mt-6">
        {state.status === "loading" && <p>Finding demo recommendations…</p>}
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
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                selected={selectedHotelId === hotel.id}
                onSelect={() => onSelectHotel(hotel.id)}
              />
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
        <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white">Retry</button>
      </section>}
    </>
  );
}
