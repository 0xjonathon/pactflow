"use client";
import { useMemo } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { encodeFunctionData } from "viem";
import { monadTestnet } from "@pactflow/chain";
import type { PactWalletAdapter } from "@pactflow/sdk";

export function usePactWalletAdapter(): PactWalletAdapter | undefined {
  const { address, chainId } = useAccount();
  const { data: client } = useWalletClient();
  return useMemo(() => {
    if (!address || !chainId || !client?.account) return undefined;
    return {
      address, chainId,
      sendContractTransaction: request => client.sendTransaction({
        account: client.account, chain: monadTestnet, to: request.address,
        data: encodeFunctionData({ abi: request.abi, functionName: request.functionName, args: request.args }),
      }),
    };
  }, [address, chainId, client]);
}
