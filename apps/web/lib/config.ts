import {
  defineChain,
  getAddress,
  isAddress,
  zeroAddress,
  type Address,
} from "viem";

const env = process.env;
const chainId = Number(env.NEXT_PUBLIC_CHAIN_ID ?? "11155111");
const rpcUrl = env.NEXT_PUBLIC_RPC_URL;
const contractValue = env.NEXT_PUBLIC_CROWDFUNDING_ADDRESS ?? "";
const tokenValue = env.NEXT_PUBLIC_TOKEN_ADDRESS ?? "";
const explorerUrl = env.NEXT_PUBLIC_EXPLORER_URL;
const apiUrl = env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

function addressOrZero(value: string): Address {
  return isAddress(value) ? getAddress(value) : zeroAddress;
}

export const appChain = defineChain({
  id: chainId,
  name: chainId === 11155111 ? "Sepolia" : `Configured network (${chainId})`,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: rpcUrl ? [rpcUrl] : [] } },
  blockExplorers: explorerUrl
    ? {
        default: {
          name: "Configured explorer",
          url: explorerUrl.replace(/\/$/, ""),
        },
      }
    : chainId === 11155111
      ? { default: { name: "Etherscan", url: "https://sepolia.etherscan.io" } }
      : undefined,
  testnet: true,
});

export const appConfig = {
  chainId,
  apiUrl,
  isApiConfigured: Boolean(apiUrl),
  contractAddress: addressOrZero(contractValue),
  deploymentBlock: BigInt(env.NEXT_PUBLIC_DEPLOYMENT_BLOCK ?? "0"),
  walletConnectProjectId: env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  supportedToken: {
    address: addressOrZero(tokenValue),
    symbol: env.NEXT_PUBLIC_TOKEN_SYMBOL ?? "TOKEN",
    decimals: Number(env.NEXT_PUBLIC_TOKEN_DECIMALS ?? "18"),
  },
  isConfigured:
    isAddress(contractValue) &&
    contractValue !== zeroAddress &&
    Boolean(rpcUrl) &&
    isAddress(tokenValue) &&
    tokenValue !== zeroAddress,
} as const;

export function explorerTxUrl(hash: string): string | undefined {
  const explorer = appChain.blockExplorers?.default.url;
  return explorer ? `${explorer}/tx/${hash}` : undefined;
}

export function explorerAddressUrl(address: Address): string | undefined {
  const explorer = appChain.blockExplorers?.default.url;
  return explorer ? `${explorer}/address/${address}` : undefined;
}
