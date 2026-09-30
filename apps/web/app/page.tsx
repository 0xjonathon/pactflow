"use client";
import { useState } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { getExplorerAddressUrl, monadTestnet } from "@pactflow/chain";
import { WalletBar } from "../components/WalletBar";
import { protocolConfig } from "../lib/protocol";

export default function Home() {
  const [escrow, setEscrow] = useState("");
  let config: ReturnType<typeof protocolConfig> | undefined;
  try { config = protocolConfig(); } catch { /* deployment still pending */ }
  return <main className="shell">
    <header className="topbar"><Link href="/" className="brand">PactFlow<span style={{ color: "var(--accent)" }}>.</span></Link><WalletBar /></header>
    <section className="hero"><div className="eyebrow">Monad Testnet · Direct Pact</div><h1>Work without trust.<br />Settle with proof.</h1><p>Create a direct work agreement, fund an ERC20 escrow, and release payment after a real milestone approval on Monad Testnet.</p><div className="actions"><Link href="/pacts/new"><button>Create a Pact</button></Link><a href="#open"><button className="secondary">Open Existing Pact</button></a></div></section>
    <div className="grid"><section className="card"><h2>Connected network</h2><div className="row"><span>Network</span><strong>{monadTestnet.name}</strong></div><div className="row"><span>Chain ID</span><strong>{monadTestnet.id}</strong></div><p className="small">Wallet status appears above. Transactions require an injected wallet on this network.</p></section>
    <section className="card"><h2>Protocol addresses</h2>{config ? <><div className="row"><span>Factory</span><a className="mono" href={getExplorerAddressUrl(config.addresses.PactFactory)} target="_blank" rel="noreferrer">{config.addresses.PactFactory}</a></div><div className="row"><span>Reputation</span><a className="mono" href={getExplorerAddressUrl(config.addresses.ReputationRegistry)} target="_blank" rel="noreferrer">{config.addresses.ReputationRegistry}</a></div><div className="row"><span>Settlement token</span><a className="mono" href={getExplorerAddressUrl(config.addresses.SettlementToken)} target="_blank" rel="noreferrer">{config.addresses.SettlementToken}</a></div></> : <p className="small">Protocol deployment is not configured yet. No contract addresses are being invented.</p>}</section></div>
    <section className="card" id="open"><h2>Open Existing Pact</h2><p className="small">Paste a Pact Escrow address. This page reads the current state directly from Monad Testnet.</p><div className="actions"><input className="mono" style={{ flex: 1, minWidth: 250 }} value={escrow} onChange={event => setEscrow(event.target.value.trim())} placeholder="0x… escrow address" /><Link href={isAddress(escrow) ? `/pacts/${escrow}` : "#open"}><button disabled={!isAddress(escrow)}>Open Pact</button></Link></div></section>
  </main>;
}
