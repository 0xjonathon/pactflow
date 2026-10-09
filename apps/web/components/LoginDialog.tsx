"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useSwitchChain } from "wagmi";
import { monadTestnet } from "@pactflow/chain";
import { useI18n } from "../lib/i18n";
import { readableError } from "../features/transaction/useTransactionFlow";
import { api, post, useSession, ErrorMessage } from "../lib/product";

type GoogleSdk = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        nonce: string;
        auto_select: boolean;
        callback: (response: { credential: string }) => void;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: {
          theme: string;
          size: string;
          text: string;
          width: number;
          locale: string;
        },
      ) => void;
    };
  };
};
let googleScript: Promise<GoogleSdk> | undefined;
function loadGoogle() {
  return (googleScript ??= new Promise<GoogleSdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const sdk = (window as unknown as { google?: GoogleSdk }).google;
      if (sdk) resolve(sdk);
      else {
        googleScript = undefined;
        reject(new Error("GOOGLE_UNAVAILABLE"));
      }
    };
    script.onerror = () => {
      script.remove();
      googleScript = undefined;
      reject(new Error("GOOGLE_UNAVAILABLE"));
    };
    document.head.append(script);
  }));
}
export function LoginDialog() {
  const { t, locale } = useI18n();
  const session = useSession();
  const { address, chainId } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const googleButton = useRef<HTMLDivElement>(null);
  const attemptedPath = useRef("");
  const googleAttempt = useRef(false);
  const [step, setStep] = useState<"choice" | "wallet">("choice");
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [googleConfig, setGoogleConfig] = useState<{ enabled: boolean }>();
  useEffect(() => {
    void api<{ enabled: boolean }>("/auth/google/config")
      .then(setGoogleConfig)
      .catch(() => setGoogleConfig({ enabled: false }));
  }, []);
  useEffect(() => {
    const protectedPage =
      /^\/(pacts\/new|jobs\/new|jobs\/[^/]+\/collaborate|onboarding|app|notifications)(\/|$)/.test(
        path,
      );
    if (
      session.ready &&
      protectedPage &&
      !session.user &&
      attemptedPath.current !== path
    ) {
      attemptedPath.current = path;
      session.openAuth();
    }
    if (!protectedPage || session.user) attemptedPath.current = "";
  }, [path, session]);
  useEffect(() => {
    if (session.authOpen) {
      setStep(session.account ? "wallet" : "choice");
      setError(undefined);
      googleAttempt.current = false;
      setGoogleReady(false);
      setGoogleLoading(false);
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [session.authOpen]);
  useEffect(() => {
    if (
      session.authOpen &&
      step === "choice" &&
      googleConfig?.enabled &&
      !googleAttempt.current
    )
      void startGoogle();
  }, [session.authOpen, step, googleConfig]);
  async function startGoogle() {
    googleAttempt.current = true;
    setGoogleLoading(true);
    setError(undefined);
    try {
      const challenge = await post<{
        id: string;
        nonce: string;
        clientId: string;
      }>("/auth/google/challenge");
      const google = await loadGoogle();
      if (!dialog.current?.open || !googleButton.current) return;
      google.accounts.id.initialize({
        client_id: challenge.clientId,
        nonce: challenge.nonce,
        auto_select: false,
        callback: (response) => {
          void session
            .googleSignIn(challenge.id, response.credential)
            .then(() => {
              setStep("wallet");
            })
            .catch(setError);
        },
      });
      googleButton.current.replaceChildren();
      google.accounts.id.renderButton(googleButton.current, {
        theme: "outline",
        size: "large",
        text: "signup_with",
        width: Math.min(320, googleButton.current.clientWidth || 280),
        locale,
      });
      setGoogleReady(true);
    } catch (e) {
      setError(e);
    } finally {
      setGoogleLoading(false);
    }
  }
  async function connectWallet() {
    setPending(true);
    setError(undefined);
    try {
      let wallet = address;
      let network = chainId;
      if (!wallet) {
        if (!connectors[0] || !(await connectors[0].getProvider()))
          throw new Error("WALLET_UNAVAILABLE");
        const connected = await connectAsync({ connector: connectors[0] });
        wallet = connected.accounts[0];
        network = connected.chainId;
      }
      if (network !== monadTestnet.id)
        await switchChainAsync({ chainId: monadTestnet.id });
      await session.authenticate(wallet);
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="login-dialog"
      aria-labelledby="login-title"
      aria-describedby="login-description"
      onCancel={(event) => {
        if (pending || session.busy) event.preventDefault();
        else session.closeAuth();
      }}
      onClose={session.closeAuth}
    >
      <button
        className="dialog-close secondary"
        aria-label={t("auth.close")}
        disabled={pending || session.busy}
        onClick={session.closeAuth}
      >
        ×
      </button>
      <div className="login-mark" aria-hidden="true">
        ↗
      </div>
      <p className="eyebrow">
        {t("auth.step", { step: step === "choice" ? 1 : 2 })}
      </p>
      <h2 id="login-title">
        {t(step === "choice" ? "auth.title" : "auth.walletTitle")}
      </h2>
      <p id="login-description">
        {t(step === "choice" ? "auth.description" : "auth.walletHelp")}
      </p>
      {step === "choice" ? (
        <div className="login-options">
          {!googleReady && (
            <button
              className="google-choice secondary"
              disabled={!googleConfig?.enabled || googleLoading || session.busy}
              onClick={() => void startGoogle()}
            >
              <span aria-hidden="true">G</span>
              {t(googleLoading ? "auth.loadingGoogle" : "auth.google")}
            </button>
          )}
          <div
            ref={googleButton}
            className="google-button"
            hidden={!googleReady}
          />
          {googleConfig?.enabled === false && (
            <p className="small">{t("auth.googleUnavailable")}</p>
          )}
          <div className="login-divider">
            <span>{t("auth.or")}</span>
          </div>
          <button
            className="secondary"
            disabled={session.busy}
            onClick={() => setStep("wallet")}
          >
            {t("auth.guest")}
          </button>
          <p className="small login-caption">{t("auth.guestHelp")}</p>
        </div>
      ) : (
        <div className="login-options">
          <div className="login-identity">
            <span className="account-avatar" aria-hidden="true">
              {(session.account?.name || session.guestName).slice(0, 1)}
            </span>
            <div>
              <strong>{session.account?.name || session.guestName}</strong>
              <p className="small">
                {t(
                  session.account ? "auth.googleAccount" : "auth.guestAccount",
                )}
              </p>
            </div>
          </div>
          {address && (
            <p className="mono small">
              {address.slice(0, 6)}…{address.slice(-4)}
            </p>
          )}
          <button
            disabled={pending || isPending || session.busy}
            onClick={() => void connectWallet()}
          >
            {t(
              pending || session.busy
                ? "auth.connecting"
                : "auth.connectWallet",
            )}
          </button>
          <p className="small login-caption">{t("auth.signatureHelp")}</p>
          {!session.account && (
            <button
              className="text-button"
              disabled={pending}
              onClick={() => {
                googleAttempt.current = false;
                setGoogleReady(false);
                setStep("choice");
              }}
            >
              {t("auth.back")}
            </button>
          )}
        </div>
      )}
      {error && readableError(error).code !== "errors.generic" ? (
        <div role="alert" className="notice error">
          {t(readableError(error).code)}
        </div>
      ) : (
        <ErrorMessage error={error || session.error} />
      )}
    </dialog>
  );
}
