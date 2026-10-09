"use client";
import Link from "next/link";
import { useI18n } from "../lib/i18n";

export function WorkJourney({ step }: { step: number }) {
  const { t } = useI18n();
  return (
    <ol className="work-journey" aria-label={t("journey.flow")}>
      {(
        [
          "brief",
          "match",
          "agreement",
          "delivery",
          "review",
          "receipt",
        ] as const
      ).map((key, index) => (
        <li
          key={key}
          aria-current={index === step ? "step" : undefined}
          className={index < step ? "complete" : ""}
        >
          <span>{index < step ? "✓" : index + 1}</span>
          {t(`journey.${key}`)}
        </li>
      ))}
    </ol>
  );
}

export function CreationPaths() {
  const { t } = useI18n();
  return (
    <div className="creation-paths">
      <Link href="/jobs/new" className="card">
        <span className="eyebrow">{t("journey.findPartner")}</span>
        <h3>{t("marketplace.post")}</h3>
        <p>{t("journey.briefDescription")}</p>
        <strong>{t("journey.publishFirst")} ↗</strong>
      </Link>
      <Link href="/pacts/new" className="card">
        <span className="eyebrow">{t("journey.partnerReady")}</span>
        <h3>{t("journey.direct")}</h3>
        <p>{t("journey.agreementDescription")}</p>
        <strong>{t("journey.confirmTerms")} ↗</strong>
      </Link>
    </div>
  );
}

export function HowItWorksPage() {
  const { t } = useI18n();
  return (
    <main className="shell">
      <div className="page-title">
        <p className="eyebrow">PactFlow</p>
        <h1>{t("journey.how")}</h1>
        <p>{t("journey.difference")}</p>
      </div>
      <CreationPaths />
      <WorkJourney step={0} />
      <section className="journey-explanations">
        {(
          [
            "brief",
            "match",
            "agreement",
            "delivery",
            "review",
            "receipt",
          ] as const
        ).map((key, index) => (
          <article className="card" key={key}>
            <span className="eyebrow">0{index + 1}</span>
            <h2>{t(`journey.${key}`)}</h2>
            <p>{t(`journey.${key}Help`)}</p>
          </article>
        ))}
      </section>
      <section className="card">
        <h2>{t("journey.roles")}</h2>
        <dl className="journey-glossary">
          <dt>{t("v2.client")}</dt>
          <dd>{t("journey.clientRole")}</dd>
          <dt>{t("v2.builder")}</dt>
          <dd>{t("journey.workerRole")}</dd>
          <dt>{t("v2.arbitrator")}</dt>
          <dd>{t("journey.arbitratorRole")}</dd>
        </dl>
        <p>{t("journey.walletRule")}</p>
      </section>
      <div className="actions">
        <Link className="button" href="/jobs/new">
          {t("marketplace.post")}
        </Link>
        <Link className="button secondary" href="/discover">
          {t("marketplace.find")}
        </Link>
      </div>
    </main>
  );
}
