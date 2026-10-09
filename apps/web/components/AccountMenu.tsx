"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/product";
import { WalletBar } from "./WalletBar";

export function AccountMenu() {
  const { t } = useI18n();
  const { account, guestName, user, openAuth, signOut } = useSession();
  const { isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const name = account?.name || guestName;
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  if (!account && !isConnected)
    return (
      <button className="account-login secondary" onClick={openAuth}>
        {t("auth.login")}
      </button>
    );
  return (
    <div className="account-menu account-control" ref={root}>
      <button
        ref={trigger}
        className="account-trigger secondary"
        aria-label={t("auth.accountMenu")}
        aria-expanded={open}
        aria-controls="account-panel"
        onClick={() => setOpen(!open)}
      >
        <span className="account-avatar" aria-hidden="true">
          {name.slice(0, 1)}
        </span>
        <span className="account-trigger-name">{name}</span>
        <span
          className={`account-status ${user ? "connected" : ""}`}
          aria-label={t(user ? "wallet.connected" : "wallet.notConnected")}
        />
        <span className="account-chevron" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div
          className="account-panel"
          id="account-panel"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          <div className="account-heading">
            <span className="account-avatar" aria-hidden="true">
              {name.slice(0, 1)}
            </span>
            <div>
              <strong>{name}</strong>
              <p className="small">
                {t(account ? "auth.googleAccount" : "auth.guestAccount")}
              </p>
            </div>
          </div>
          <WalletBar />
          {user && (
            <div className="account-links">
              <Link href={`/u/${user.handle}`}>{t("marketplace.profile")}</Link>
              <Link href="/onboarding">{t("profile.edit")}</Link>
              <Link href="/notifications">{t("notifications.title")}</Link>
            </div>
          )}
          {account ? (
            <button
              className="secondary"
              onClick={() => {
                void signOut().catch(() => {});
                setOpen(false);
              }}
            >
              {t("auth.logout")}
            </button>
          ) : (
            <button
              className="secondary"
              onClick={() => {
                setOpen(false);
                openAuth();
              }}
            >
              {t("auth.loginGoogle")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
