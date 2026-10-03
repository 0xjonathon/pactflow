"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";
import { protocolSdk } from "../../../lib/protocol";
import { useI18n } from "../../../lib/i18n";
import { LegacyPactDetail } from "./legacy-detail";
import { PactRoom } from "../../../components/PactRoom";
export function PactDetail({
  escrowAddress,
  agreementURI,
}: {
  escrowAddress: string;
  agreementURI?: string;
}) {
  const { t } = useI18n();
  const sdk = useMemo(() => protocolSdk(), []);
  const version = useQuery({
    queryKey: ["protocol-version", escrowAddress],
    queryFn: () => sdk.getProtocolVersion(escrowAddress as Address),
    enabled: isAddress(escrowAddress),
    retry: false,
  });
  if (version.error)
    return (
      <main className="shell">
        <p role="alert">{t("v2.unavailable")}</p>
      </main>
    );
  if (!version.data)
    return (
      <main className="shell">
        <div className="skeleton" />
      </main>
    );
  return version.data === 2 ? (
    <PactRoom escrow={escrowAddress as Address} />
  ) : (
    <LegacyPactDetail
      escrowAddress={escrowAddress}
      agreementURI={agreementURI}
    />
  );
}
