"use client";
import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ErrorMessage, post, useData } from "../lib/product";
import { useI18n } from "../lib/i18n";

export type Disclosure = {
  publicId: string;
  payload: { title: string; description: string };
  clientApproved: boolean;
  workerApproved: boolean;
};

export function PactReceiptPanel({
  disclosure,
  role,
  defaultTitle,
  busy,
  onApprove,
}: {
  disclosure: Disclosure | null;
  role: "client" | "worker";
  defaultTitle: string;
  busy: boolean;
  onApprove: (payload: Disclosure["payload"]) => void;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const published =
    !!disclosure?.clientApproved && !!disclosure?.workerApproved;
  const approved =
    role === "client" ? disclosure?.clientApproved : disclosure?.workerApproved;
  return (
    <section className="pact-receipt" aria-labelledby="receipt-heading">
      <div>
        <h3 id="receipt-heading">{t("v2.receipt")}</h3>
        <p className="small">{t("v2.receiptOptional")}</p>
      </div>
      {disclosure ? (
        <>
          <div className="receipt-copy">
            <strong>{disclosure.payload.title}</strong>
            {disclosure.payload.description && (
              <p className="preserve">{disclosure.payload.description}</p>
            )}
          </div>
          <dl className="receipt-consents">
            <div>
              <dt>{t("v2.client")}</dt>
              <dd>
                {t(
                  disclosure.clientApproved
                    ? "v2.disclosureApproved"
                    : "v2.disclosurePending",
                )}
              </dd>
            </div>
            <div>
              <dt>{t("pact.worker")}</dt>
              <dd>
                {t(
                  disclosure.workerApproved
                    ? "v2.disclosureApproved"
                    : "v2.disclosurePending",
                )}
              </dd>
            </div>
          </dl>
          {published ? (
            <div role="status">
              <p className="small">{t("v2.receiptPublished")}</p>
              <Link
                className="button secondary"
                href={`/p/${disclosure.publicId}`}
              >
                {t("v2.openReceipt")} ↗
              </Link>
            </div>
          ) : approved ? (
            <p role="status" className="small">
              {t("v2.consentPending")}
            </p>
          ) : (
            <>
              <p className="small">{t("v2.receiptReview")}</p>
              <button
                disabled={busy}
                onClick={() => onApprove(disclosure.payload)}
              >
                {t("v2.publish")}
              </button>
            </>
          )}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onApprove({
              title: title.trim() || defaultTitle,
              description: description.trim(),
            });
          }}
        >
          <label htmlFor="receipt-title">
            {t("v2.shareTitle")}
            <input
              id="receipt-title"
              maxLength={160}
              placeholder={defaultTitle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label htmlFor="receipt-description">
            {t("v2.shareDescription")}
            <textarea
              id="receipt-description"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <p className="small">{t("v2.receiptPropose")}</p>
          <button disabled={busy} type="submit">
            {t("v2.proposeReceipt")}
          </button>
        </form>
      )}
    </section>
  );
}

export function PactReceipt({
  escrow,
  address,
  role,
  defaultTitle,
}: {
  escrow: string;
  address: string;
  role: "client" | "worker";
  defaultTitle: string;
}) {
  const { t } = useI18n();
  const cache = useQueryClient();
  const key = `disclosure-${escrow}-${address.toLowerCase()}`;
  const path = `/pacts/${escrow}/disclosure`;
  const disclosure = useData<Disclosure | null>(key, path);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const approve = async (payload: Disclosure["payload"]) => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await post<Disclosure>(path, payload);
      cache.setQueryData(["product", key, path], result);
      await disclosure.refetch();
    } catch (e) {
      setError(e);
      // A concurrent proposal must be reviewed verbatim, never overwritten.
      await disclosure.refetch();
    } finally {
      setBusy(false);
    }
  };
  if (disclosure.isLoading)
    return <p role="status">{t("v2.receiptLoading")}</p>;
  if (disclosure.isError)
    return (
      <div className="pact-receipt">
        <ErrorMessage error={disclosure.error} />
        <button className="secondary" onClick={() => disclosure.refetch()}>
          {t("v2.retry")}
        </button>
      </div>
    );
  return (
    <>
      <ErrorMessage error={error} />
      <PactReceiptPanel
        disclosure={disclosure.data ?? null}
        role={role}
        defaultTitle={defaultTitle}
        busy={busy}
        onApprove={approve}
      />
    </>
  );
}
