import type { Metadata } from "next";
import { CreateMarketForm } from "@/components/creation/CreateMarketForm";
import { PoweredByPanta } from "@/components/common/PoweredByPanta";
import { listCategories } from "@/lib/panta/markets";

export const metadata: Metadata = {
  title: "Create Market",
  description: "Create a new Panta prediction market from your own Solana wallet.",
};

export const dynamic = "force-dynamic";

/** Panta's documented allowlist, used only if the categories call fails. */
const FALLBACK_CATEGORIES = [
  "sports",
  "crypto",
  "politics",
  "entertainment",
  "finance",
  "science",
  "world",
  "other",
];

export default async function CreateMarketPage() {
  let categories = FALLBACK_CATEGORIES;
  let categoriesLive = false;

  try {
    const fetched = await listCategories();
    if (fetched.length > 0) {
      categories = fetched;
      categoriesLive = true;
    }
  } catch {
    // Panta unreachable or unconfigured: the form still renders and the quote
    // call will surface the real error rather than failing the whole page.
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Create market
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--color-muted)]">
            Publish a new prediction market to Panta. You pay the creation fee from your own
            wallet and earn creator fees once the market graduates.
          </p>
        </div>
        <PoweredByPanta />
      </div>

      <div className="pp-panel mb-5 p-4">
        <h2 className="text-sm font-semibold">Before you start</h2>
        <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm leading-relaxed text-[var(--color-muted)] sm:grid-cols-2">
          <li>• Creation charges a real USDC fee, quoted by Panta before you sign.</li>
          <li>• Part of that fee seeds the market&apos;s initial liquidity.</li>
          <li>• Your connected wallet becomes the market creator on-chain.</li>
          <li>• Creator fees become claimable once the market graduates.</li>
        </ul>
        {!categoriesLive && (
          <p className="mt-3 text-xs text-[var(--color-warning)]">
            Panta&apos;s live category list could not be loaded, so the documented default
            allowlist is shown. If a category is rejected at quote time, that is why.
          </p>
        )}
      </div>

      <CreateMarketForm categories={categories} />
    </div>
  );
}
