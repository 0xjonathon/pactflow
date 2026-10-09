"use client";

import { useI18n } from "../lib/i18n";

export function DeploymentNotice() {
  const { t } = useI18n();
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE !== "frontend") return null;
  return (
    <aside className="deployment-notice" aria-label={t("deployment.preview")}>
      <strong>{t("deployment.preview")}</strong>
      <span>{t("deployment.pending")}</span>
    </aside>
  );
}
