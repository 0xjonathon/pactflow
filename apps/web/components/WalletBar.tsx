"use client";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { monadTestnet } from "@pactflow/chain";

export function WalletBar() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  if (!isConnected) return <div className="wallet"><span className="small">Wallet not connected</span><button disabled={isPending || !connectors[0]} onClick={() => connectors[0] && connect({ connector: connectors[0] })}>Connect Wallet</button></div>;
  return <div className="wallet"><span className="small">Connected Wallet</span><span className="mono small">{address?.slice(0, 6)}…{address?.slice(-4)}</span>{chainId === monadTestnet.id ? <span className="pill">Monad Testnet</span> : <><span className="danger">Wrong Network</span><button disabled={switching} onClick={() => switchChain({ chainId: monadTestnet.id })}>Switch to Monad Testnet</button></>}<button className="secondary" onClick={() => disconnect()}>Disconnect</button></div>;
}

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, chainId } = useAccount();
  if (!isConnected) return <div className="notice">Connect an injected wallet to submit a transaction.</div>;
  if (chainId !== monadTestnet.id) return <div className="notice error">Wrong Network. Switch to Monad Testnet before submitting.</div>;
  return <>{children}</>;
}
