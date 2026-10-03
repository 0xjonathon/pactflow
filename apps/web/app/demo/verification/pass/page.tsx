export default function PassingVerificationFixture() {
  return (
    <main style={{ maxWidth: 900, margin: "auto", padding: 32 }}>
      <nav>
        <a href="#dashboard">Dashboard</a> · <a href="#activity">Activity</a>
      </nav>
      <h1>Monad Analytics Dashboard</h1>
      <p>
        Track Monad protocol activity and project metrics in one responsive
        dashboard.
      </p>
      <button data-testid="connect-wallet">Connect Wallet</button>
      <section
        id="dashboard"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 16,
        }}
      >
        <article>
          <h2>Transactions</h2>
          <p>12,481</p>
        </article>
        <article>
          <h2>Active Wallets</h2>
          <p>3,420</p>
        </article>
        <article>
          <h2>Settled Volume</h2>
          <p>82,000 USDC</p>
        </article>
      </section>
      <section id="activity">
        <h2>Activity</h2>
        <p>Recent protocol activity is shown here.</p>
      </section>
    </main>
  );
}
