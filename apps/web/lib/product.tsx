"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { PactStatus } from "@pactflow/sdk";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n, type MessageKey } from "./i18n";
export const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:3002");
export type Metrics = {
  passRate?: number | null;
  revisionRate?: number | null;
  verificationRuns?: number;
  submissionCount?: number;
  completedPacts: number;
  settledVolume: string;
  successfulMilestones: number;
  aiVerified: number;
  humanVerified: number;
  disputes: number;
  disputesLost: number | null;
  onTimeRate: number | null;
  repeatCounterpartyRate: number | null;
  disputeRate?: number | null;
  repeatCounterparties?: number;
};
export type Person = {
  id: string;
  handle: string;
  displayName: string;
  role: string;
  bio: string;
  skills: string[];
  category: string;
  intent: string;
  demo: boolean;
  wallet?: string;
  reputation: Metrics | null;
};
export type Milestone = { title: string; amount: string; dueAt: string };
export type Job = {
  id: string;
  clientId: string;
  title: string;
  description: string;
  requirements: string;
  category: string;
  skills: string[];
  budget: string;
  deadline: string;
  milestones: Milestone[];
  verificationMode: "ClientOnly" | "AIOnly" | "Hybrid";
  policy: unknown;
  clientDeposit: string;
  workerDeposit: string;
  status: string;
  demo: boolean;
  escrowAddress?: string;
  fundsLocked: boolean;
  pactStatus?: PactStatus;
  worker?: Person;
  client: Person;
};
export type Proposal = {
  id: string;
  jobId: string;
  workerId: string;
  workerAddress: string;
  message: string;
  estimatedDays: number;
  status: string;
  worker: Person;
};
export type InputIssue = {
  path: Array<string | number>;
  code: string;
  message: string;
  minimum?: number;
  maximum?: number;
};
export class ApiError extends Error {
  constructor(
    code: string,
    readonly issues: InputIssue[] = [],
  ) {
    super(code);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem("pactflow_session");
  const response = await fetch(`${API}/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(data.code || "generic", data.issues ?? []);
  return data;
}
export const post = <T,>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export function useData<T>(key: string, path: string, enabled = true) {
  return useQuery({
    queryKey: ["product", key, path],
    queryFn: () => api<T>(path),
    enabled,
    refetchInterval: 15000,
    retry: false,
  });
}
export function analytics(
  event: string,
  properties: Record<string, string | number | boolean> = {},
) {
  void post("/analytics", { event, properties }).catch(() => {});
}
export type AccountIdentity = { name: string; provider: "google" };
const SessionContext = createContext<{
  user: Person | null;
  account: AccountIdentity | null;
  guestName: string;
  ready: boolean;
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  authenticate: (address: `0x${string}`) => Promise<void>;
  googleSignIn: (id: string, credential: string) => Promise<void>;
  signOut: () => Promise<void>;
  disconnectWallet: () => void;
  refresh: () => Promise<void>;
  busy: boolean;
  error: string;
} | null>(null);
async function accountApi<T>(path: string, options: RequestInit = {}) {
  return api<T>(`/auth/google${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${localStorage.getItem("pactflow_account") ?? ""}`,
    },
  });
}
export function SessionProvider({ children }: { children: ReactNode }) {
  const { address, status } = useAccount();
  const currentAddress = useRef(address);
  currentAddress.current = address;
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const query = useQueryClient();
  const [user, setUser] = useState<Person | null>(null);
  const [account, setAccount] = useState<AccountIdentity | null>(null);
  const [guestName, setGuestName] = useState("");
  const [ready, setReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const value = await api<Person>("/me");
      setUser(
        value.wallet?.toLowerCase() === address?.toLowerCase() ? value : null,
      );
    } catch {
      setUser(null);
    }
  }, [address]);
  useEffect(() => {
    let nickname = localStorage.getItem("pactflow_guest_name");
    if (!nickname) {
      nickname = `Guest-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      localStorage.setItem("pactflow_guest_name", nickname);
    }
    setGuestName(nickname);
    if (localStorage.getItem("pactflow_account"))
      void accountApi<AccountIdentity>("/me")
        .then(setAccount)
        .catch(() => localStorage.removeItem("pactflow_account"));
  }, []);
  useEffect(() => {
    if (status === "connecting" || status === "reconnecting") return;
    let active = true;
    setReady(false);
    setUser(null);
    void query.resetQueries({ queryKey: ["product"] });
    const restore = async () => {
      const token = localStorage.getItem("pactflow_session");
      if (token) {
        try {
          const value = await api<Person>("/me");
          if (!active) return;
          if (address && value.wallet?.toLowerCase() === address.toLowerCase())
            setUser(value);
          else {
            void post("/auth/logout").catch(() => {});
            localStorage.removeItem("pactflow_session");
          }
        } catch {
          if (active) localStorage.removeItem("pactflow_session");
        }
      }
      if (active) setReady(true);
    };
    void restore();
    return () => {
      active = false;
    };
  }, [address, status, query]);
  const authenticate = async (walletAddress: `0x${string}`) => {
    setBusy(true);
    setError("");
    try {
      const challenge = await post<{ id: string; message: string }>(
        "/auth/challenge",
        { address: walletAddress },
      );
      const signature = await signMessageAsync({
        account: walletAddress,
        message: challenge.message,
      });
      const session = await post<{ token: string; user: Person }>(
        "/auth/verify",
        { id: challenge.id, signature, guestName },
      );
      if (
        currentAddress.current?.toLowerCase() !== walletAddress.toLowerCase()
      ) {
        await api("/auth/logout", {
          method: "POST",
          body: "{}",
          headers: { Authorization: `Bearer ${session.token}` },
        }).catch(() => {});
        throw new Error("WALLET_CHANGED");
      }
      localStorage.setItem("pactflow_session", session.token);
      setUser(session.user);
      void query.resetQueries({ queryKey: ["product"] });
      analytics("wallet_connected");
      setAuthOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "generic");
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const googleSignIn = async (id: string, credential: string) => {
    setBusy(true);
    setError("");
    try {
      const result = await post<{ token: string; account: AccountIdentity }>(
        "/auth/google/verify",
        { id, credential },
      );
      localStorage.setItem("pactflow_account", result.token);
      setAccount(result.account);
    } catch (e) {
      setError(e instanceof Error ? e.message : "generic");
      throw e;
    } finally {
      setBusy(false);
    }
  };
  return (
    <SessionContext.Provider
      value={{
        user,
        account,
        guestName: user?.displayName || guestName,
        ready,
        authOpen,
        busy,
        error,
        refresh,
        authenticate,
        googleSignIn,
        openAuth: () => {
          setError("");
          setAuthOpen(true);
        },
        closeAuth: () => setAuthOpen(false),
        signOut: async () => {
          try {
            await accountApi("/logout", { method: "POST", body: "{}" });
          } finally {
            localStorage.removeItem("pactflow_account");
            setAccount(null);
          }
        },
        disconnectWallet: () => {
          void post("/auth/logout").catch(() => {});
          localStorage.removeItem("pactflow_session");
          setUser(null);
          void query.resetQueries({ queryKey: ["product"] });
          disconnect();
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider missing");
  return value;
}
export function ErrorMessage({ error }: { error: unknown }) {
  const { t } = useI18n();
  if (!error) return null;
  const code = error instanceof Error ? error.message : String(error);
  const key = `productErrors.${code}` as MessageKey;
  return (
    <div role="alert" className="notice error">
      {t(key) === key ? t("productErrors.generic") : t(key)}
      {error instanceof ApiError && error.issues.length > 0 && (
        <ul>
          {error.issues.map((issue, i) => (
            <li key={i}>
              {issue.path.join(" · ")}:{" "}
              {issue.message.startsWith("form.")
                ? t(issue.message as MessageKey)
                : t("form.serverField")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function SignInCard() {
  const { t } = useI18n();
  const { openAuth } = useSession();
  return (
    <section className="card sign-in">
      <h3>{t("auth.requiredTitle")}</h3>
      <p className="small">{t("auth.requiredHelp")}</p>
      <button onClick={openAuth}>{t("auth.start")}</button>
    </section>
  );
}
export function amount(value: string | number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(
    Number(value),
  );
}
export function rawAmount(value?: string) {
  return amount(Number(value ?? 0) / 1e6);
}
export function categoryLabel(
  category: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  return t(`marketplace.${category.toLowerCase()}` as MessageKey);
}
export function methodLabel(
  method: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  return t(
    method === "AIOnly"
      ? "jobs.aiReview"
      : method === "Hybrid"
        ? "jobs.hybridReview"
        : "jobs.clientReview",
  );
}
