"use client";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { monadTestnet } from "@pactflow/chain";
import { useI18n } from "../lib/i18n";

export function WalletBar() {
  const { t } = useI18n();
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  if (!isConnected)
    return (
      <div className="wallet">
        <span className="small">{t("wallet.notConnected")}</span>
        <button
          disabled={isPending || !connectors[0]}
          onClick={() => connectors[0] && connect({ connector: connectors[0] })}
        >
          {t("wallet.connect")}
        </button>
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
      <button className="secondary" onClick={() => disconnect()}>
        {t("wallet.disconnect")}
      </button>
    </div>
  );
}

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { isConnected, chainId } = useAccount();
  if (!isConnected)
    return <div className="notice">{t("wallet.connectToSubmit")}</div>;
  if (chainId !== monadTestnet.id)
    return (
      <div className="notice error">
        {t("wallet.wrongNetwork")}. {t("wallet.switchToSubmit")}
      </div>
    );
  return <>{children}</>;
}
