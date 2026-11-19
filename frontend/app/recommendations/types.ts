import type { Recommendations } from "../../lib/api";

export type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; result: Recommendations }
  | { status: "error"; message: string };
