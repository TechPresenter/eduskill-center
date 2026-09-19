import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api/errors";

/** Awaits a service call in a server component; a 404 ApiError becomes Next's notFound(). */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
