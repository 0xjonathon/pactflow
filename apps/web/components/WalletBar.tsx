"use client";
import { useAccount, useSwitchChain } from "wagmi";
import { monadTestnet } from "@pactflow/chain";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/product";

export function WalletBar() {
  const { t } = useI18n();
  const { address, chainId, isConnected } = useAccount();
  const { openAuth, disconnectWallet } = useSession();
  const { switchChain, isPending: switching } = useSwitchChain();
  if (!isConnected)
    return (
      <div className="wallet">
        <span className="small">{t("wallet.notConnected")}</span>
        <button onClick={openAuth}>{t("wallet.connect")}</button>
      </div>
    );
  return (
    <div className="wallet">
      <span className="small">{t("wallet.connected")}</span>
      <span className="mono small">
        {address?.slice(0, 6)}…{address?.slice(-4)}
      </span>
      {chainId === monadTestnet.id ? (
        <span className="pill">
          {t(
            process.env.NEXT_PUBLIC_LOCAL_CHAIN === "true"
              ? "v2.localChain"
              : "common.monadTestnet",
          )}
        </span>
      ) : (
        <>
          <span className="danger">{t("wallet.wrongNetwork")}</span>
          <button
            disabled={switching}
            onClick={() => switchChain({ chainId: monadTestnet.id })}
          >
            {t("wallet.switchNetwork")}
          </button>
        </>
      )}
      <button className="secondary" onClick={disconnectWallet}>
        {t("wallet.disconnect")}
      </button>
    </div>
  );
}

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { isConnected, chainId } = useAccount();
  const { openAuth } = useSession();
  if (!isConnected)
    return (
      <div className="notice">
        <p>{t("wallet.connectToSubmit")}</p>
        <button onClick={openAuth}>{t("auth.start")}</button>
      </div>
    );
  if (chainId !== monadTestnet.id)
    return (
      <div className="notice error">
        {t("wallet.wrongNetwork")}. {t("wallet.switchToSubmit")}
      </div>
    );
  return <>{children}</>;
}
