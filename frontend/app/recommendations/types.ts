export type Scenario = "success" | "empty" | "error";
export type Hotel = {
  id: string;
  name: string;
  nightlyPrice: number;
  currency: string;
  breakfastIncluded: boolean;
  explanation: string;
};
export type Recommendations = { message: string; hotels: Hotel[] };
export type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: Recommendations }
  | { status: "error"; message: string };
