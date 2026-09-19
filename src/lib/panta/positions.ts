import "server-only";

import { pantaRequest } from "./client";
import type { PantaPositions } from "./types";

/** Wallet-scoped holdings. Never shared-cached. */
export async function listPositions(wallet: string): Promise<PantaPositions> {
  const { data } = await pantaRequest<PantaPositions>({
    path: "/positions/",
    query: { wallet },
    revalidate: false,
  });
  return { wallet: data?.wallet ?? wallet, positions: data?.positions ?? [] };
}
