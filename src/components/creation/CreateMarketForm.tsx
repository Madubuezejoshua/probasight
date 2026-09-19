"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { PoweredByPanta } from "@/components/common/PoweredByPanta";
import { ErrorState, Spinner } from "@/components/common/States";
import { explorerTxUrl } from "@/lib/env";
import { uploadMarketImage, validateMarketImage } from "@/lib/image-upload";
import { formatUsdcBaseUnits } from "@/lib/utils/format";
import {
  MINIMUM_START_DELAY_SECONDS,
  datetimeLocalToUnix,
  secondsUntilIso,
  unixToDatetimeLocal,
} from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";
import { CreateFailureHint } from "./CreateHints";
import { CREATE_STAGE_LABELS, useCreateFlow } from "./useCreateFlow";

type FieldErrors = Partial<Record<string, string>>;

const HOUR = 3600;

/**
 * Market creation.
 *
 * Fields map one-to-one onto POST /markets/create/quote/. Nothing is invented:
 * categories come from Panta's allowlist, and timing rules mirror the
 * documented constraints (startTime at least minimumStartDelay ahead, and
 * startTime < endTime <= resolutionTime).
 */
export function CreateMarketForm({ categories }: { categories: string[] }) {
  const { connected, publicKey } = useWallet();
  const flow = useCreateFlow();

  const now = useMemo(() => Math.floor(Date.now() / 1000), []);

  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [resolutionRule, setResolutionRule] = useState("");
  const [sources, setSources] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "other");
  const [region, setRegion] = useState("Global");
  const [marketType, setMarketType] = useState<"standard" | "breaking">("standard");
  const [eventInProgress, setEventInProgress] = useState(false);

  const [startTime, setStartTime] = useState(() => unixToDatetimeLocal(now + 2 * HOUR));
  const [endTime, setEndTime] = useState(() => unixToDatetimeLocal(now + 26 * HOUR));
  const [resolutionTime, setResolutionTime] = useState(() =>
    unixToDatetimeLocal(now + 27 * HOUR),
  );

  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [countdown, setCountdown] = useState<number | null>(null);

  // The create session lives ~5 minutes; expire it in the UI so a stale
  // createId is never carried into a signing prompt.
  useEffect(() => {
    if (!flow.quote?.expiresAt) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const remaining = secondsUntilIso(flow.quote!.expiresAt);
      setCountdown(remaining);
      if (remaining !== null && remaining <= 0) flow.clearQuote();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [flow]);

  const sourceList = useMemo(
    () =>
      sources
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    [sources],
  );

  const validate = useCallback((): FieldErrors => {
    const errors: FieldErrors = {};
    const start = datetimeLocalToUnix(startTime);
    const end = datetimeLocalToUnix(endTime);
    const resolve = datetimeLocalToUnix(resolutionTime);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (question.trim().length < 10) {
      errors.question = "Ask a specific, verifiable question (at least 10 characters).";
    }
    if (question.trim().length > 512) errors.question = "Maximum 512 characters.";
    if (resolutionRule.trim().length < 20) {
      errors.resolutionRule =
        "Describe precisely how this resolves, including timing and edge cases.";
    }
    if (sourceList.length === 0) {
      errors.sources = "Add at least one source of truth, one per line.";
    }
    if (sourceList.length > 20) errors.sources = "Maximum 20 sources.";
    if (!imageUrl.trim()) {
      errors.imageUrl = "A public image URL is required by Panta.";
    } else if (!/^https?:\/\//i.test(imageUrl.trim())) {
      errors.imageUrl = "Image URL must start with http:// or https://";
    }
    if (!start) errors.startTime = "Pick a start time.";
    if (!end) errors.endTime = "Pick an end time.";
    if (!resolve) errors.resolutionTime = "Pick a resolution time.";

    if (start && !eventInProgress && start < nowSeconds + MINIMUM_START_DELAY_SECONDS) {
      errors.startTime = `Panta requires a start at least ${
        MINIMUM_START_DELAY_SECONDS / 60
      } minutes from now.`;
    }
    if (start && end && start >= end) {
      errors.endTime = "End time must be after the start time.";
    }
    if (end && resolve && resolve < end) {
      errors.resolutionTime = "Resolution time must be at or after the end time.";
    }
    if (end && end <= nowSeconds) errors.endTime = "End time must be in the future.";
    if (eventInProgress && marketType !== "breaking") {
      errors.eventInProgress = "Only breaking markets can already be in progress.";
    }
    return errors;
  }, [
    question,
    resolutionRule,
    sourceList,
    imageUrl,
    startTime,
    endTime,
    resolutionTime,
    eventInProgress,
    marketType,
  ]);

  async function onPickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const invalid = validateMarketImage(file);
    if (invalid) {
      setImageError(invalid);
      return;
    }
    setImageError(null);
    setImageUploading(true);
    try {
      const url = await uploadMarketImage(file);
      setImageUrl(url);
      setFieldErrors((current) => ({ ...current, imageUrl: undefined }));
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setImageUploading(false);
    }
  }

  function onRequestQuote() {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    void flow.requestQuote({
      question: question.trim(),
      resolutionRule: resolutionRule.trim(),
      sourcesOfTruth: sourceList,
      category,
      startTime: datetimeLocalToUnix(startTime)!,
      endTime: datetimeLocalToUnix(endTime)!,
      resolutionTime: datetimeLocalToUnix(resolutionTime)!,
      imageUrl: imageUrl.trim(),
      marketType,
      ...(eventInProgress ? { eventInProgress: true } : {}),
      title: question.trim().slice(0, 512),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(region.trim() ? { region: region.trim() } : {}),
    });
  }

  const busy = !["idle", "quoted", "error", "completed"].includes(flow.stage);

  // ------------------------------------------------------------- success

  if (flow.stage === "completed" && flow.result) {
    return (
      <div className="pp-card pp-fade mx-auto max-w-2xl p-6 text-center sm:p-8">
        <span
          aria-hidden
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-yes-dim)] text-lg font-bold text-[var(--color-yes)]"
        >
          ✓
        </span>
        <h2 className="mt-4 text-lg font-semibold">Market created</h2>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">
          Panta verified the on-chain transaction and registered the market.
        </p>

        <dl className="mt-6 space-y-2.5 text-left text-sm">
          <SummaryRow label="Title">{flow.result.title}</SummaryRow>
          <SummaryRow label="Market id">
            <span className="break-all font-mono text-xs">{flow.result.marketId}</span>
          </SummaryRow>
          <SummaryRow label="Status">
            <span className="font-mono text-xs">{flow.result.status}</span>
          </SummaryRow>
          <SummaryRow label="Signature">
            <a
              href={explorerTxUrl(flow.result.signature)}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-xs text-[var(--color-accent)] hover:underline"
            >
              {flow.result.signature} ↗
            </a>
          </SummaryRow>
        </dl>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/markets/${flow.result.marketId}`}
            className="pp-btn pp-btn-primary flex-1"
          >
            Open market
          </Link>
          <Link href="/portfolio" className="pp-btn pp-btn-secondary flex-1">
            Created markets
          </Link>
        </div>
        <PoweredByPanta variant="subtle" className="mt-6" />
      </div>
    );
  }

  // ---------------------------------------------------------------- form

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-6">
      <div className="min-w-0 space-y-5">
        <section className="pp-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold">The question</h2>
          <p className="pp-hint mt-1">
            A good market question has exactly one correct answer once the resolution time
            passes, and no room for interpretation.
          </p>

          <div className="mt-4 space-y-4">
            <Field
              label="Question"
              htmlFor="question"
              error={fieldErrors.question}
              hint="Example: Will Bitcoin close above $150,000 on 31 December 2026 (UTC)?"
            >
              <input
                id="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={512}
                placeholder="Will …?"
                className="pp-input"
              />
            </Field>

            <Field
              label="Description"
              htmlFor="description"
              optional
              error={fieldErrors.description}
              hint="Extra context shown on the market page."
            >
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="pp-input resize-y"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="category">
                <select
                  id="category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="pp-input capitalize"
                >
                  {categories.map((slug) => (
                    <option key={slug} value={slug}>
                      {slug}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Region" htmlFor="region" optional>
                <input
                  id="region"
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  className="pp-input"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Market type" htmlFor="marketType">
                <select
                  id="marketType"
                  value={marketType}
                  onChange={(event) => {
                    const next = event.target.value as "standard" | "breaking";
                    setMarketType(next);
                    if (next !== "breaking") setEventInProgress(false);
                  }}
                  className="pp-input"
                >
                  <option value="standard">Standard</option>
                  <option value="breaking">Breaking</option>
                </select>
              </Field>
              {marketType === "breaking" && (
                <Field
                  label="Event already in progress"
                  htmlFor="eventInProgress"
                  error={fieldErrors.eventInProgress}
                  hint="Skips Panta's minimum start delay. Breaking markets only."
                >
                  <label className="flex items-center gap-2 pt-2 text-sm text-[var(--color-muted)]">
                    <input
                      id="eventInProgress"
                      type="checkbox"
                      checked={eventInProgress}
                      onChange={(event) => setEventInProgress(event.target.checked)}
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                    Event is already under way
                  </label>
                </Field>
              )}
            </div>
          </div>
        </section>

        <section className="pp-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Resolution</h2>
          <p className="pp-hint mt-1">
            This is what a resolver reads to settle the market. Be specific about the
            measurement, the timezone and what happens in an edge case.
          </p>

          <div className="mt-4 space-y-4">
            <Field
              label="Resolution rule"
              htmlFor="resolutionRule"
              error={fieldErrors.resolutionRule}
              hint="Example: Resolves YES if the CoinGecko BTC/USD daily close on 2026-12-31 (UTC) is above $150,000.00. Otherwise NO."
            >
              <textarea
                id="resolutionRule"
                value={resolutionRule}
                onChange={(event) => setResolutionRule(event.target.value)}
                rows={4}
                maxLength={2048}
                className="pp-input resize-y"
              />
            </Field>

            <Field
              label="Sources of truth"
              htmlFor="sources"
              error={fieldErrors.sources}
              hint="One per line, up to 20. Prefer stable, publicly checkable sources."
            >
              <textarea
                id="sources"
                value={sources}
                onChange={(event) => setSources(event.target.value)}
                rows={3}
                placeholder={"https://www.coingecko.com\nhttps://example.org/official-results"}
                className="pp-input resize-y font-mono text-xs"
              />
            </Field>
          </div>
        </section>

        <section className="pp-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Timing</h2>
          <p className="pp-hint mt-1">
            Panta requires start &lt; end ≤ resolution, and (unless the event is already in
            progress on a breaking market) a start at least{" "}
            {MINIMUM_START_DELAY_SECONDS / 60} minutes from now.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Opens" htmlFor="startTime" error={fieldErrors.startTime}>
              <input
                id="startTime"
                type="datetime-local"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="pp-input"
              />
            </Field>
            <Field label="Closes" htmlFor="endTime" error={fieldErrors.endTime}>
              <input
                id="endTime"
                type="datetime-local"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="pp-input"
              />
            </Field>
            <Field
              label="Resolves"
              htmlFor="resolutionTime"
              error={fieldErrors.resolutionTime}
            >
              <input
                id="resolutionTime"
                type="datetime-local"
                value={resolutionTime}
                onChange={(event) => setResolutionTime(event.target.value)}
                className="pp-input"
              />
            </Field>
          </div>
        </section>

        <section className="pp-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Market image</h2>
          <p className="pp-hint mt-1">
            Required by Panta. A square 1024×1024 image looks best. Upload through Panta&apos;s
            image helper or paste a public URL you already host.
          </p>

          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label
                className={cn(
                  "pp-btn pp-btn-secondary cursor-pointer",
                  imageUploading && "pointer-events-none opacity-60",
                )}
              >
                {imageUploading ? (
                  <>
                    <Spinner /> Uploading…
                  </>
                ) : (
                  "Upload image"
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={onPickImage}
                  disabled={imageUploading}
                  className="sr-only"
                />
              </label>
              {imageUrl && (
                <div className="relative h-11 w-11 overflow-hidden rounded-[10px] border border-[var(--color-border-subtle)]">
                  <Image src={imageUrl} alt="Market image preview" fill className="object-cover" />
                </div>
              )}
            </div>

            <Field label="Image URL" htmlFor="imageUrl" error={fieldErrors.imageUrl}>
              <input
                id="imageUrl"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://…"
                className="pp-input font-mono text-xs"
              />
            </Field>

            {imageError && (
              <p className="text-xs text-[var(--color-no)]" role="alert">
                {imageError}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------- preview + review */}
      <aside className="min-w-0">
        <div className="space-y-4 lg:sticky lg:top-20">
          <div className="pp-card overflow-hidden">
            <div className="border-b border-[var(--color-border-subtle)] px-4 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-faint)]">
                Live preview
              </p>
            </div>
            <div className="p-4">
              <div className="flex items-start gap-3">
                {imageUrl ? (
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[10px] border border-[var(--color-border-subtle)]">
                    <Image src={imageUrl} alt="" fill className="object-cover" />
                  </div>
                ) : (
                  <div
                    aria-hidden
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-dashed border-[var(--color-border-subtle)] text-xs text-[var(--color-faint)]"
                  >
                    img
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-3 text-sm font-semibold text-[var(--color-text)]">
                    {question.trim() || "Your market question appears here"}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-[var(--color-faint)]">
                      {category}
                    </span>
                    <span className="pp-chip">Primary</span>
                  </div>
                </div>
              </div>
              <p className="pp-hint mt-3">
                Pricing starts on Panta&apos;s bonding curve once the market opens.
              </p>
            </div>
          </div>

          {/* Review card: the last thing seen before a wallet prompt. */}
          <div className="pp-card p-4">
            <h3 className="text-sm font-semibold">Creation summary</h3>

            {!connected ? (
              <>
                <p className="pp-hint mt-2">
                  Connect a Solana wallet to request the creation quote. The wallet you
                  connect becomes the market creator and pays the creation fee.
                </p>
                <ConnectWalletButton className="mt-3 w-full" />
              </>
            ) : flow.quote ? (
              <div className="pp-fade mt-3">
                <dl className="space-y-2 text-sm">
                  <SummaryRow label="Creation fee">
                    <span className="tabular font-semibold">
                      {formatUsdcBaseUnits(flow.quote.paymentUsdc)}
                    </span>
                  </SummaryRow>
                  {flow.quote.liquidityInjectionUsdc && (
                    <SummaryRow label="→ Liquidity">
                      <span className="tabular text-[var(--color-muted)]">
                        {formatUsdcBaseUnits(flow.quote.liquidityInjectionUsdc)}
                      </span>
                    </SummaryRow>
                  )}
                  {flow.quote.platformRevenueUsdc && (
                    <SummaryRow label="→ Platform">
                      <span className="tabular text-[var(--color-muted)]">
                        {formatUsdcBaseUnits(flow.quote.platformRevenueUsdc)}
                      </span>
                    </SummaryRow>
                  )}
                  <SummaryRow label="Creator">
                    <span className="font-mono text-xs">
                      {publicKey?.toBase58().slice(0, 4)}…{publicKey?.toBase58().slice(-4)}
                    </span>
                  </SummaryRow>
                  <SummaryRow label="Event address">
                    <span className="break-all font-mono text-[10px]">
                      {flow.quote.expectedEventPda}
                    </span>
                  </SummaryRow>
                </dl>

                {countdown !== null && countdown > 0 && (
                  <p className="tabular mt-2 text-[11px] text-[var(--color-muted)]">
                    Session expires in {Math.floor(countdown / 60)}m {countdown % 60}s
                  </p>
                )}

                <p className="mt-3 rounded-[var(--radius-control)] border border-[var(--color-warning)]/25 bg-[var(--color-warning-dim)]/40 p-2.5 text-xs leading-relaxed text-[var(--color-warning)]">
                  Signing next will spend{" "}
                  {formatUsdcBaseUnits(flow.quote.paymentUsdc)} from your wallet. This is a
                  real on-chain transaction.
                </p>

                {busy && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text)]">
                    <Spinner className="text-[var(--color-accent)]" />
                    {CREATE_STAGE_LABELS[flow.stage]}
                  </p>
                )}

                {flow.error && (
                  <div className="mt-3">
                    <ErrorState error={flow.error} compact />
                    <CreateFailureHint error={flow.error} />
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void flow.signAndRegister(flow.quote!, question.trim())}
                    className="pp-btn pp-btn-primary flex-1"
                  >
                    {busy ? CREATE_STAGE_LABELS[flow.stage] : "Sign & create market"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={flow.clearQuote}
                    className="pp-btn pp-btn-secondary"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="pp-hint mt-2">
                  Panta validates the parameters and returns the exact creation fee before
                  anything is signed.
                </p>

                {flow.error && (
                  <div className="mt-3">
                    <ErrorState error={flow.error} compact />
                    <CreateFailureHint error={flow.error} />
                  </div>
                )}

                <button
                  type="button"
                  disabled={flow.stage === "quoting"}
                  onClick={onRequestQuote}
                  className="pp-btn pp-btn-primary mt-3 w-full"
                >
                  {flow.stage === "quoting" ? (
                    <>
                      <Spinner /> Requesting quote…
                    </>
                  ) : (
                    "Get creation quote"
                  )}
                </button>
              </>
            )}

            <PoweredByPanta variant="subtle" className="mt-4" />
          </div>
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
  error,
  hint,
  optional,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  optional?: boolean;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="pp-label">
        {label}
        {optional && (
          <span className="ml-1.5 font-normal text-[var(--color-faint)]">optional</span>
        )}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-[var(--color-no)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="pp-hint mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs text-[var(--color-muted)]">{label}</dt>
      <dd className="min-w-0 text-right text-[var(--color-text)]">{children}</dd>
    </div>
  );
}
