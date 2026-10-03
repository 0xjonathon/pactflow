"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useI18n, type MessageKey } from "./i18n";
import { WalletBar } from "../components/WalletBar";
export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
export type Metrics = { completedPacts: number; settledVolume: string; successfulMilestones: number; aiVerified: number; humanVerified: number; disputes: number; disputesLost: number | null; onTimeRate: number | null; repeatCounterpartyRate: number | null; disputeRate?: number | null; repeatCounterparties?: number };
export type Person = { id: string; handle: string; displayName: string; role: string; bio: string; skills: string[]; category: string; intent: string; demo: boolean; wallet?: string; reputation: Metrics | null };
export type Milestone = { title: string; amount: string; dueAt: string };
export type Job = { id: string; clientId: string; title: string; description: string; requirements: string; category: string; skills: string[]; budget: string; deadline: string; milestones: Milestone[]; verificationMode: "ClientOnly" | "AIOnly" | "Hybrid"; policy: unknown; clientDeposit: string; workerDeposit: string; status: string; demo: boolean; escrowAddress?: string; fundsLocked: boolean; pactStatus?: string; worker?: Person; client: Person };
export type Proposal = { id: string; jobId: string; workerId: string; workerAddress: string; message: string; estimatedDays: number; status: string; worker: Person };
export type InputIssue = {path: Array<string | number>; code: string; message: string; minimum?: number; maximum?: number};
export class ApiError extends Error { constructor(code:string,readonly issues:InputIssue[]=[]){super(code);} }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window === "undefined" ? null : window.localStorage.getItem("pactflow_session");
  const response = await fetch(`${API}/api/v1${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json(); if (!response.ok) throw new ApiError(data.code || "generic",data.issues ?? []); return data;
}
export const post = <T,>(path: string, body: unknown = {}) => api<T>(path, { method: "POST", body: JSON.stringify(body) });
export function useData<T>(key: string, path: string, enabled = true) { return useQuery({ queryKey: ["product", key, path], queryFn: () => api<T>(path), enabled, refetchInterval: 15000, retry: false }); }
export function analytics(event: string, properties: Record<string, string | number | boolean> = {}) { void post("/analytics", { event, properties }).catch(() => {}); }
const SessionContext = createContext<{ user: Person | null; signIn: () => Promise<void>; signOut: () => void; refresh: () => Promise<void>; busy: boolean; error: string } | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount(); const { signMessageAsync } = useSignMessage();
  const [user, setUser] = useState<Person | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const refresh = async () => { try { setUser(await api<Person>("/me")); } catch { setUser(null); } };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if (user && address && user.wallet?.toLowerCase() !== address.toLowerCase()) { window.localStorage.removeItem("pactflow_session"); setUser(null); } }, [address, user]);
  const signIn = async () => { if (!address) return; setBusy(true); setError(""); try { const challenge = await post<{ id: string; message: string }>("/auth/challenge", { address }); const signature = await signMessageAsync({ message: challenge.message }); const session = await post<{ token: string; user: Person }>("/auth/verify", { id: challenge.id, signature }); window.localStorage.setItem("pactflow_session", session.token); setUser(session.user); analytics("wallet_connected"); } catch (e) { setError(e instanceof Error ? e.message : "generic"); } finally { setBusy(false); } };
  return <SessionContext.Provider value={{ user, refresh, signIn, busy, error, signOut: () => { window.localStorage.removeItem("pactflow_session"); setUser(null); } }}>{children}</SessionContext.Provider>;
}
export function useSession() { const value = useContext(SessionContext); if (!value) throw new Error("SessionProvider missing"); return value; }
export function ErrorMessage({ error }: { error: unknown }) { const { t } = useI18n(); if (!error) return null; const code = error instanceof Error ? error.message : String(error); const key = `productErrors.${code}` as MessageKey; return <div role="alert" className="notice error">{["SIGN_IN_REQUIRED", "SESSION_EXPIRED", "INVALID_SIGNATURE", "INVALID_INPUT", "ALREADY_EXISTS", "ALREADY_MATCHED", "CANNOT_APPLY_OWN_JOB", "JOB_NOT_OPEN", "INVALID_JOB_STATE", "PACT_DRAFT_MISMATCH"].includes(code) ? t(key) : t("productErrors.generic")}{error instanceof ApiError && error.issues.length>0&&<ul>{error.issues.map((issue,i)=><li key={i}>{issue.path.join(" · ")}: {issue.message.startsWith("form.")?t(issue.message as MessageKey):t("form.serverField")}</li>)}</ul>}</div>; }
export function SignInCard() { const { t } = useI18n(); const session = useSession(); const { address } = useAccount(); return <section className="card sign-in"><h3>{t("profile.signIn")}</h3><p className="small">{t("profile.signHelp")}</p><WalletBar />{address && <button disabled={session.busy} onClick={session.signIn}>{t("profile.signIn")}</button>}<ErrorMessage error={session.error} /></section>; }
export function amount(value: string | number) { return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(Number(value)); }
export function rawAmount(value?: string) { return amount(Number(value ?? 0) / 1e6); }
export function categoryLabel(category: string, t: ReturnType<typeof useI18n>["t"]) { return t(`marketplace.${category.toLowerCase()}` as MessageKey); }
export function methodLabel(method: string, t: ReturnType<typeof useI18n>["t"]) { return t(method === "AIOnly" ? "jobs.aiReview" : method === "Hybrid" ? "jobs.hybridReview" : "jobs.clientReview"); }
