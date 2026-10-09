"use client";
import { useI18n } from "../lib/i18n";
export function PactReviewPanel({
  automated,
  manual,
  busy,
  reason,
  onReason,
  onVerify,
  onApprove,
  onRevise,
}: {
  automated: boolean;
  manual: boolean;
  busy: boolean;
  reason: string;
  onReason: (value: string) => void;
  onVerify: () => void;
  onApprove: () => void;
  onRevise: () => void;
}) {
  const { t } = useI18n();
  if (!automated && !manual) return null;
  return (
    <div className="pact-review">
      <div className="pact-review-actions">
        {automated && (
          <button disabled={busy} onClick={onVerify}>
            {t("v2.startVerification")}
          </button>
        )}
        {manual && (
          <button disabled={busy} onClick={onApprove}>
            {t("v2.approve")}
          </button>
        )}
      </div>
      {manual && (
        <div className="pact-revision-form">
          <label htmlFor="revision-reason">{t("v2.reason")}</label>
          <textarea
            id="revision-reason"
            rows={3}
            value={reason}
            onChange={(e) => onReason(e.target.value)}
          />
          <button
            className="secondary"
            disabled={busy || !reason.trim()}
            onClick={onRevise}
          >
            {t("v2.requestRevision")}
          </button>
        </div>
      )}
    </div>
  );
}
