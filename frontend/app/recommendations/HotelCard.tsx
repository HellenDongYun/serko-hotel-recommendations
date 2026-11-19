import type { Hotel } from "./types";

type Props = {
  hotel: Hotel;
  selected: boolean;
  onSelect: () => void;
};

export function HotelCard({ hotel, selected, onSelect }: Props) {
  return (
    <article aria-labelledby={`hotel-${hotel.id}`}
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 break-words">
      <h3 id={`hotel-${hotel.id}`} className="text-xl font-semibold">{hotel.name}</h3>
      <p className="mt-3 font-semibold">{hotel.currency} {hotel.nightlyPrice.toFixed(2)} per night</p>
      <p className="mt-2">{hotel.breakfastIncluded ? "Breakfast included" : "Breakfast not included"}</p>
      <p className="mt-3 text-slate-600">{hotel.explanation}</p>
      <button type="button" aria-pressed={selected}
        onClick={onSelect}
        className="mt-5 w-full rounded-lg border border-teal-800 px-4 py-3 font-semibold text-teal-900 aria-pressed:bg-teal-800 aria-pressed:text-white">
        Select {hotel.name}
      </button>
    </article>
  );
}
