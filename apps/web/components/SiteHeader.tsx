"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/product";
import { LanguageMenu } from "./LanguageMenu";
import { WalletBar } from "./WalletBar";
export function SiteHeader() {
  const { t } = useI18n();
  const { user, signOut } = useSession();
  const path = usePathname();
  const links = [
    ["/discover", "marketplace.discover"],
    ["/app", "v2.pacts"],
    ["/network", "v2.network"],
    ["/reputation", "marketplace.reputation"],
    ["/activity", "v2.activity"],
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
              href="/pacts/new"
              onClick={(e) =>
                e.currentTarget.closest("details")?.removeAttribute("open")
              }
            >
              {t("v2.create")}
            </Link>
          </div>
        </details>
        <div className="nav-actions">
          <Link className="button" href="/pacts/new">
            {t("v2.create")}
          </Link>
          <LanguageMenu />
          <details className="account-menu">
            <summary>
              {user?.displayName?.slice(0, 12) || t("marketplace.profile")}{" "}
              <span>⌄</span>
            </summary>
            <div className="account-panel">
              <span className="pill">
                {t(
                  process.env.NEXT_PUBLIC_LOCAL_CHAIN === "true"
                    ? "v2.localChain"
                    : "marketplace.testnet",
                )}
              </span>
              <WalletBar />
              {user ? (
                <>
                  <Link href={`/u/${user.handle}`}>
                    {t("marketplace.profile")}
                  </Link>
                  <Link href="/onboarding">{t("profile.edit")}</Link>
                  <Link href="/notifications">{t("notifications.title")}</Link>
                  <button className="secondary" onClick={signOut}>
                    {t("profile.disconnect")}
                  </button>
                </>
              ) : (
                <Link className="button" href="/onboarding">
                  {t("onboarding.getStarted")}
                </Link>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
