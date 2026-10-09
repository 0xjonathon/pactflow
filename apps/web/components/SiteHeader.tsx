"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "../lib/i18n";
import { LanguageMenu } from "./LanguageMenu";
import { AccountMenu } from "./AccountMenu";
export function SiteHeader() {
  const { t } = useI18n();
  const path = usePathname();
  const links = [
    ["/discover", "marketplace.discover"],
    ["/app", "marketplace.work"],
    ["/network", "v2.network"],
    ["/reputation", "marketplace.reputation"],
    ["/activity", "v2.activity"],
    ["/how-it-works", "journey.how"],
  ];
  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link className="brand" href="/">
          PactFlow<span>↗</span>
        </Link>
        <nav aria-label={t("marketplace.menu")}>
          {links.map(([href, key]) => (
            <Link
              className={path.startsWith(href) ? "active" : ""}
              key={href}
              href={href}
            >
              {t(key as "marketplace.discover")}
            </Link>
          ))}
        </nav>
        <details className="mobile-menu">
          <summary aria-label={t("marketplace.menu")}>☰</summary>
          <div>
            {links.map(([href, key]) => (
              <Link
                key={href}
                href={href}
                onClick={(e) =>
                  e.currentTarget.closest("details")?.removeAttribute("open")
                }
              >
                {t(key as "marketplace.discover")}
              </Link>
            ))}
            <Link
              href="/jobs/new"
              onClick={(e) =>
                e.currentTarget.closest("details")?.removeAttribute("open")
              }
            >
              {t("marketplace.post")}
            </Link>
            <Link
              href="/pacts/new"
              onClick={(e) =>
                e.currentTarget.closest("details")?.removeAttribute("open")
              }
            >
              {t("journey.direct")}
            </Link>
          </div>
        </details>
        <div className="nav-actions">
          <Link className="button" href="/jobs/new">
            {t("marketplace.post")}
          </Link>
          <LanguageMenu />
          <AccountMenu />
        </div>
      </div>
      <div className="mobile-work-actions">
        <Link href="/jobs/new">{t("marketplace.post")} ↗</Link>
        <Link href="/discover">{t("marketplace.find")}</Link>
      </div>
    </header>
  );
}
