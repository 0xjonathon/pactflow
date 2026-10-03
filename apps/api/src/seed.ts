import { config } from "dotenv";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { connectDatabase } from "@pactflow/db/client";
import { users, wallets, jobs } from "@pactflow/db";
config({ path: resolve(process.cwd(), "../../.env.local"), quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const { db, close } = connectDatabase(process.env.DATABASE_URL);
try {
  const demoPeople = [
    {
      handle: "demo-studio",
      displayName: "Demo Studio",
      role: "Product team",
      bio: "Illustrative client profile for exploring PactFlow. No real completed work is claimed.",
      skills: ["Product"],
      category: "Development",
      intent: "HIRE",
    },
    {
      handle: "demo-builder",
      displayName: "Demo Builder",
      role: "Frontend developer",
      bio: "Demo talent profile. Metrics are not fabricated.",
      skills: ["React", "TypeScript", "Design"],
      category: "Development",
      intent: "WORK",
    },
    {
      handle: "demo-researcher",
      displayName: "Demo Researcher",
      role: "Research specialist",
      bio: "Demo talent profile for the product walkthrough.",
      skills: ["Research", "Data"],
      category: "Research",
      intent: "WORK",
    },
  ];
  for (const p of demoPeople)
    await db
      .insert(users)
      .values({ ...p, demo: true })
      .onConflictDoNothing();
  const [client] = await db
    .select()
    .from(users)
    .where(eq(users.handle, "demo-studio"));
  const specs = [
    ["Monad Dashboard", "Development", ["React", "Monad"], 300],
    ["Landing Page", "Design", ["Figma", "Frontend"], 200],
    ["Research Task", "Research", ["Research"], 120],
    ["Frontend Integration", "Development", ["TypeScript", "Wallet"], 250],
    ["Data Collection", "Data", ["JSON", "Data"], 80],
    ["Design Task", "Design", ["UI", "Figma"], 160],
    ["Content Task", "Content", ["Writing"], 90],
    ["AI Data Task", "Data", ["JSON", "Validation"], 140],
  ] as const;
  const deadline = new Date(Date.now() + 21 * 86400_000);
  for (const [title, category, skills, budget] of specs) {
    const existing = await db.select().from(jobs).where(eq(jobs.title, title));
    if (existing.some((j) => j.demo)) continue;
    await db.insert(jobs).values({
      clientId: client.id,
      title,
      description: `Demo brief: deliver a clear, usable ${title.toLowerCase()} for a Monad project. Agree on the scope and verify the final result before releasing payment.`,
      requirements:
        "Deliver the agreed artifact with a short handover note. This is a clearly marked demo listing; no funds have been locked.",
      category,
      skills: [...skills],
      budget: String(budget),
      deadline,
      milestones: [
        {
          title: "Final delivery",
          amount: String(budget),
          dueAt: deadline.toISOString(),
        },
      ],
      verificationMode: "ClientOnly",
      clientDeposit: String(budget * 0.05),
      workerDeposit: "0",
      status: "OPEN",
      demo: true,
    });
  }
  for (const [handle, address, name] of [
    [
      "testnet-client",
      "0x6677bcf814d7c23a4afd565691c6b24494bf5e9a",
      "Testnet Client",
    ],
    [
      "testnet-worker",
      "0x786e6f51e928286d35084129f359c6fea391357e",
      "Testnet Worker",
    ],
  ]) {
    const known = await db
      .select()
      .from(wallets)
      .where(eq(wallets.address, address));
    if (known.length) continue;
    const [u] = await db
      .insert(users)
      .values({
        handle,
        displayName: name,
        role: "PactFlow test participant",
        bio: "Real Monad Testnet cooperation history. Test account; profile information is illustrative.",
        intent: "BOTH",
        demo: true,
      })
      .onConflictDoNothing()
      .returning();
    if (u) await db.insert(wallets).values({ address, userId: u.id });
  }
  console.log("8 clearly labelled demo jobs and test profiles ready");
} finally {
  await close();
}
