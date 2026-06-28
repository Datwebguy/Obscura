function requiredValue(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredUrl(value: string | undefined, name: string) {
  const configured = requiredValue(value, name);
  try {
    return new URL(configured).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

function optionalUrl(value: string | undefined, name: string) {
  if (!value?.trim()) return undefined;
  return requiredUrl(value, name);
}

function requiredContractId(value: string | undefined, name: string) {
  const configured = requiredValue(value, name);
  if (!/^C[A-Z2-7]{55}$/.test(configured)) {
    throw new Error(`${name} must be a valid Stellar contract ID`);
  }
  return configured;
}

export const obscuraConfig = Object.freeze({
  horizonUrl: requiredUrl(
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL,
    "NEXT_PUBLIC_STELLAR_HORIZON_URL",
  ),
  rpcUrl: requiredUrl(
    process.env.NEXT_PUBLIC_STELLAR_RPC_URL,
    "NEXT_PUBLIC_STELLAR_RPC_URL",
  ),
  explorerUrl: requiredUrl(
    process.env.NEXT_PUBLIC_STELLAR_EXPLORER_URL,
    "NEXT_PUBLIC_STELLAR_EXPLORER_URL",
  ),
  networkPassphrase: requiredValue(
    process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
    "NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE",
  ),
  xlmPoolId: requiredContractId(
    process.env.NEXT_PUBLIC_SPP_XLM_POOL_ID,
    "NEXT_PUBLIC_SPP_XLM_POOL_ID",
  ),
  membershipId: requiredContractId(
    process.env.NEXT_PUBLIC_SPP_ASP_MEMBERSHIP_ID,
    "NEXT_PUBLIC_SPP_ASP_MEMBERSHIP_ID",
  ),
  bootnodeUrl: optionalUrl(
    process.env.NEXT_PUBLIC_SPP_BOOTNODE_URL,
    "NEXT_PUBLIC_SPP_BOOTNODE_URL",
  ),
});

export function testnetTransactionUrl(hash: string) {
  return `${obscuraConfig.explorerUrl}/tx/${encodeURIComponent(hash)}`;
}
