"use client";

import {
  parseSerializedFieldToBigInt,
  parseXlmToStroops,
} from "./stellar-amount";
import { obscuraConfig } from "../config";

export const SPP_RPC_URL = obscuraConfig.rpcUrl;
export const SPP_NETWORK_PASSPHRASE = obscuraConfig.networkPassphrase;
export const SPP_XLM_POOL_ID = obscuraConfig.xlmPoolId;
const SPP_BOOTNODE_URL = obscuraConfig.bootnodeUrl;

export type SppProgress = {
  flow: string;
  stage: string;
  message: string;
};

export type SppWalletBridge = {
  signAuthEntry: (
    authEntry: string,
    options?: Record<string, unknown>,
  ) => Promise<string>;
  signMessage: (
    message: string,
    options?: Record<string, unknown>,
  ) => Promise<string>;
  signTransaction: (
    transactionXdr: string,
    options?: Record<string, unknown>,
  ) => Promise<string>;
};

type SppKeys = {
  noteKeypair: { public: string };
  encryptionKeypair: { public: string };
};

type SppAspSecret = {
  membershipBlinding: bigint | string;
};

export type SppPrivateBalance = {
  poolContractId: string;
  tokenContractId: string;
  tokenLabel: string;
  amount: string;
  noteCount: number;
};

type SppRegistryLookup = {
  entry?: {
    noteKey: string;
    encryptionKey: string;
  };
  registryFullySynced?: boolean;
};

type SppAspState = {
  aspMembership?: {
    admin?: string;
    adminInsertOnly?: boolean;
    contractId?: string;
  };
};

type SppWebClient = {
  acceptDisclaimer: (address: string, hash: string) => Promise<void>;
  aspState: () => Promise<SppAspState>;
  deriveAndSaveUserKeys: (
    address: string,
    signature: Uint8Array,
  ) => Promise<void>;
  deriveAspUserLeaf: (
    membershipBlinding: bigint,
    publicKeyHex: string,
  ) => Promise<unknown>;
  executeDeposit: (
    poolId: string,
    address: string,
    amount: bigint,
    outputAmounts: bigint[],
    networkPassphrase: string,
    onProgress: (progress: SppProgress) => void,
  ) => Promise<unknown>;
  executeTransfer: (
    poolId: string,
    address: string,
    amount: bigint,
    recipientNoteKey: string,
    recipientEncryptionKey: string,
    networkPassphrase: string,
    onProgress: (progress: SppProgress) => void,
  ) => Promise<unknown>;
  executeWithdraw: (
    poolId: string,
    address: string,
    recipient: string,
    amount: bigint,
    networkPassphrase: string,
    onProgress: (progress: SppProgress) => void,
  ) => Promise<unknown>;
  getASPSecret: (address: string) => Promise<SppAspSecret | null>;
  getDisclaimerState: (
    address: string,
  ) => Promise<{ accepted?: boolean; disclaimerHashHex?: string } | null>;
  getUserKeys: (address: string) => Promise<SppKeys | null>;
  getPortfolioBalances: (address: string) => Promise<SppPrivateBalance[]>;
  keyDerivationMessage: () => string;
  lookupRegisteredPublicKey: (
    address: string,
  ) => Promise<SppRegistryLookup | null>;
  registerPublicKeys: (
    address: string,
    notePublicKey: string,
    encryptionPublicKey: string,
    networkPassphrase: string,
    onProgress: (progress: SppProgress) => void,
  ) => Promise<string>;
};

type SppModule = {
  Config: new (rpcUrl: string, bootnodeUrl?: string) => unknown;
  default: (input: { module_or_path: string } | string) => Promise<unknown>;
  mainThread: (config: unknown) => Promise<{ webClient: SppWebClient }>;
};

declare global {
  interface Window {
    __obscuraSppClientPromise?: Promise<SppWebClient>;
    __walletSignBridge?: {
      signAuthEntry: (
        authEntry: string,
        options?: Record<string, unknown>,
      ) => Promise<string>;
      signTransaction: (
        transactionXdr: string,
        options?: Record<string, unknown>,
      ) => Promise<string>;
    };
  }
}

function formatUnknownValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "bigint") return value.toString(16).padStart(64, "0");
  if (typeof value === "number") return value.toString(16).padStart(64, "0");
  if (value instanceof Uint8Array) {
    return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["leafHex", "leaf", "hex", "value"]) {
      if (record[key] !== undefined) return formatUnknownValue(record[key]);
    }
  }
  return String(value);
}

function signatureFromBase64(signature: string) {
  const binary = window.atob(signature);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function loadSppClient(bridge: SppWalletBridge) {
  window.__walletSignBridge = {
    signAuthEntry: bridge.signAuthEntry,
    signTransaction: bridge.signTransaction,
  };

  if (!window.__obscuraSppClientPromise) {
    const initialization = (async () => {
      // The SPP browser bundle is an upstream ESM/WASM artifact copied to public.
      const dynamicImport = new Function(
        "path",
        "return import(path)",
      ) as (path: string) => Promise<SppModule>;
      const spp = await dynamicImport("/js/web.js");
      await spp.default({ module_or_path: "/js/web_bg.wasm" });
      const handle = await spp.mainThread(
        new spp.Config(SPP_RPC_URL, SPP_BOOTNODE_URL || undefined),
      );
      return handle.webClient;
    });
    // Keep a rejected promise for the lifetime of this page. `mainThread`
    // installs a process-wide WASM logger before later startup work can fail;
    // retrying it in the same window would panic while installing that logger
    // again. The UI performs a clean reload before any retry after startup
    // failure.
    window.__obscuraSppClientPromise = initialization();
  }

  return window.__obscuraSppClientPromise;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

async function requestPersistentPrivateStorage() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Persistence is best effort. The browser can still use normal local storage.
  }
}

function isWorkerTimeout(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("operation timed out after") ||
    message.includes("storage worker communication error")
  );
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function retrySppWorkerOperation<T>(
  operation: () => Promise<T>,
  onProgress: (progress: SppProgress) => void,
  flow: string,
) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isWorkerTimeout(error) || attempt === maxAttempts) {
        if (isWorkerTimeout(error)) {
          throw new Error(
            "The private engine is taking longer than expected. No funds were moved. Keep this window open and try again.",
          );
        }
        throw error;
      }

      onProgress({
        flow,
        stage: "worker_retry",
        message: `The private engine is still starting. Retrying ${attempt + 1} of ${maxAttempts}`,
      });
      await wait(1_500 * attempt);
    }
  }

  throw new Error("The private engine could not be started.");
}

async function ensurePrivacyIdentity(
  client: SppWebClient,
  address: string,
  bridge: SppWalletBridge,
  onProgress: (progress: SppProgress) => void,
) {
  let keys = await retrySppWorkerOperation(
    () => client.getUserKeys(address),
    onProgress,
    "identity",
  );
  let aspSecret = await retrySppWorkerOperation(
    () => client.getASPSecret(address),
    onProgress,
    "identity",
  );

  if (!keys || !aspSecret?.membershipBlinding) {
    await requestPersistentPrivateStorage();
    onProgress({
      flow: "identity",
      stage: "derive_keys",
      message: "Approve the message signature to derive private note keys",
    });
    const signature = await bridge.signMessage(client.keyDerivationMessage(), {
      address,
      networkPassphrase: SPP_NETWORK_PASSPHRASE,
    });
    const signatureBytes = signatureFromBase64(signature);
    await retrySppWorkerOperation(
      () => client.deriveAndSaveUserKeys(address, signatureBytes),
      onProgress,
      "identity",
    );
    keys = await retrySppWorkerOperation(
      () => client.getUserKeys(address),
      onProgress,
      "identity",
    );
    aspSecret = await retrySppWorkerOperation(
      () => client.getASPSecret(address),
      onProgress,
      "identity",
    );
  }

  if (!keys || !aspSecret?.membershipBlinding) {
    throw new Error("Your private wallet setup could not be created. Please try again.");
  }

  return { keys, aspSecret };
}

async function acceptCurrentDisclaimer(
  client: SppWebClient,
  address: string,
  onProgress: (progress: SppProgress) => void,
) {
  const disclaimer = await retrySppWorkerOperation(
    () => client.getDisclaimerState(address),
    onProgress,
    "setup",
  );
  if (!disclaimer?.accepted) {
    if (!disclaimer?.disclaimerHashHex) {
      throw new Error("The Testnet notice could not be loaded. Please try again.");
    }
    const disclaimerHash = disclaimer.disclaimerHashHex;
    await retrySppWorkerOperation(
      () => client.acceptDisclaimer(address, disclaimerHash),
      onProgress,
      "setup",
    );
  }
}

function transactionHashFrom(result: unknown) {
  if (!Array.isArray(result) || result.length === 0) return null;
  const hash = result[result.length - 1];
  return typeof hash === "string" ? hash : null;
}

export class SppMembershipRequiredError extends Error {
  readonly aspLeaf: string;
  readonly accessMode: "admin_required" | "syncing" | "unknown";
  readonly adminAddress: string | null;
  readonly enrollmentHash: string | null;

  constructor(
    aspLeaf: string,
    options?: {
      accessMode?: "admin_required" | "syncing" | "unknown";
      adminAddress?: string | null;
      enrollmentHash?: string | null;
    },
  ) {
    super(
      "This privacy identity is not yet approved in the SPP ASP membership tree.",
    );
    this.name = "SppMembershipRequiredError";
    this.aspLeaf = aspLeaf;
    this.accessMode = options?.accessMode ?? "unknown";
    this.adminAddress = options?.adminAddress ?? null;
    this.enrollmentHash = options?.enrollmentHash ?? null;
  }
}

export class SppDepositLimitError extends Error {
  readonly maximumStroops: bigint;

  constructor(maximumStroops: bigint) {
    super("The requested deposit exceeds the official SPP pool limit.");
    this.name = "SppDepositLimitError";
    this.maximumStroops = maximumStroops;
  }
}

const SPP_ASP_MEMBERSHIP_ID = obscuraConfig.membershipId;

export async function getSppMaximumDepositStroops() {
  const StellarSdk = await import("@stellar/stellar-sdk");
  const server = new StellarSdk.rpc.Server(SPP_RPC_URL);
  const storageKey = StellarSdk.xdr.ScVal.scvVec([
    StellarSdk.xdr.ScVal.scvSymbol("MaximumDepositAmount"),
  ]);
  const ledgerEntry = await server.getContractData(
    SPP_XLM_POOL_ID,
    storageKey,
    StellarSdk.rpc.Durability.Persistent,
  );
  const value = ledgerEntry.val.contractData().val();

  if (value.switch().name !== "scvU256") {
    throw new Error("The SPP pool returned an invalid deposit limit.");
  }

  const limit = value.u256();
  return (
    (BigInt(limit.hiHi().toString()) << BigInt(192)) |
    (BigInt(limit.hiLo().toString()) << BigInt(128)) |
    (BigInt(limit.loHi().toString()) << BigInt(64)) |
    BigInt(limit.loLo().toString())
  );
}

function membershipEnrollmentKey(address: string, leaf: string) {
  return `obscura:spp-membership:${address}:${leaf}`;
}

async function submitPermissionlessMembership(input: {
  address: string;
  bridge: SppWalletBridge;
  leaf: bigint;
  onProgress: (progress: SppProgress) => void;
}) {
  input.onProgress({
    flow: "membership",
    stage: "membership_submit",
    message: "Adding your private address to the Testnet pool",
  });

  const StellarSdk = await import("@stellar/stellar-sdk");
  const client = await StellarSdk.contract.Client.from({
    contractId: SPP_ASP_MEMBERSHIP_ID,
    networkPassphrase: SPP_NETWORK_PASSPHRASE,
    publicKey: input.address,
    rpcUrl: SPP_RPC_URL,
    signAuthEntry: async (entry, options) => ({
      signedAuthEntry: await input.bridge.signAuthEntry(entry, options),
      signerAddress: input.address,
    }),
    signTransaction: async (transaction, options) => ({
      signedTxXdr: await input.bridge.signTransaction(transaction, options),
      signerAddress: input.address,
    }),
  });
  const membershipClient = client as unknown as {
    insert_leaf: (args: { leaf: bigint }) => Promise<{
      signAndSend: () => Promise<{
        sendTransactionResponse?: { hash?: string };
      }>;
    }>;
  };
  const transaction = await membershipClient.insert_leaf({ leaf: input.leaf });
  const sent = await transaction.signAndSend();
  const hash = sent.sendTransactionResponse?.hash;
  if (!hash) {
    throw new Error("The Testnet pool did not confirm your access request.");
  }
  return hash;
}

async function executeSppDeposit(
  client: SppWebClient,
  input: SppOperationInput,
  amount: bigint,
) {
  return retrySppWorkerOperation(
    () =>
      client.executeDeposit(
        SPP_XLM_POOL_ID,
        input.address,
        amount,
        [amount, BigInt(0)],
        SPP_NETWORK_PASSPHRASE,
        input.onProgress,
      ),
    input.onProgress,
    "deposit",
  );
}

type SppOperationInput = {
  address: string;
  amount: string;
  bridge: SppWalletBridge;
  onProgress: (progress: SppProgress) => void;
};

type SppIdentityInput = {
  address: string;
  bridge: SppWalletBridge;
  onProgress?: (progress: SppProgress) => void;
};

export type SppPrivatePortfolioResult = {
  balances: SppPrivateBalance[];
  needsUnlock: boolean;
};

type SppPrivacyIdentity = Awaited<ReturnType<typeof ensurePrivacyIdentity>>;

export type SppRegistrationState =
  | "registered"
  | "unregistered"
  | "syncing";

export async function checkSppRegistration(
  input: Pick<SppIdentityInput, "address" | "bridge">,
): Promise<SppRegistrationState> {
  const client = await loadSppClient(input.bridge);
  const registration = await client.lookupRegisteredPublicKey(input.address);
  if (registration?.entry) return "registered";
  return registration?.registryFullySynced ? "unregistered" : "syncing";
}

export async function registerSppWallet(input: SppIdentityInput) {
  const onProgress = input.onProgress ?? (() => undefined);
  const client = await loadSppClient(input.bridge);
  await acceptCurrentDisclaimer(client, input.address, onProgress);
  const { keys } = await ensurePrivacyIdentity(
    client,
    input.address,
    input.bridge,
    onProgress,
  );

  onProgress({
    flow: "register",
    stage: "prepare_tx",
    message: "Preparing your privacy address",
  });
  const hash = await client.registerPublicKeys(
    input.address,
    keys.noteKeypair.public,
    keys.encryptionKeypair.public,
    SPP_NETWORK_PASSPHRASE,
    onProgress,
  );
  if (!hash) throw new Error("The privacy address was not registered.");
  return { hash };
}

export async function getSppPrivatePortfolio(
  input: SppIdentityInput & { unlock?: boolean },
): Promise<SppPrivatePortfolioResult> {
  const onProgress = input.onProgress ?? (() => undefined);
  const client = await loadSppClient(input.bridge);
  const existingKeys = await retrySppWorkerOperation(
    () => client.getUserKeys(input.address),
    onProgress,
    "portfolio",
  );

  if (!existingKeys && !input.unlock) {
    return { balances: [], needsUnlock: true };
  }

  if (!existingKeys) {
    await acceptCurrentDisclaimer(client, input.address, onProgress);
    await ensurePrivacyIdentity(
      client,
      input.address,
      input.bridge,
      onProgress,
    );
  }

  const balances = await retrySppWorkerOperation(
    () => client.getPortfolioBalances(input.address),
    onProgress,
    "portfolio",
  );

  return {
    balances: Array.isArray(balances) ? balances : [],
    needsUnlock: false,
  };
}

async function executeWithAutomaticMembership(input: {
  client: SppWebClient;
  identity: SppPrivacyIdentity;
  operation: SppOperationInput;
  execute: () => Promise<unknown>;
}) {
  const initialResult = await input.execute();
  const initialHash = transactionHashFrom(initialResult);
  if (initialHash) return initialHash;

  const leafValue = await input.client.deriveAspUserLeaf(
    parseSerializedFieldToBigInt(
      input.identity.aspSecret.membershipBlinding,
    ),
    input.identity.keys.noteKeypair.public,
  );
  const leaf = formatUnknownValue(leafValue);
  const membershipState = await input.client.aspState().catch(() => null);
  const policy = membershipState?.aspMembership;

  if (policy?.adminInsertOnly === false) {
    const enrollmentKey = membershipEnrollmentKey(input.operation.address, leaf);
    let enrollmentHash = window.localStorage.getItem(enrollmentKey);

    if (!enrollmentHash) {
      enrollmentHash = await submitPermissionlessMembership({
        address: input.operation.address,
        bridge: input.operation.bridge,
        leaf: parseSerializedFieldToBigInt(leaf),
        onProgress: input.operation.onProgress,
      });
      window.localStorage.setItem(enrollmentKey, enrollmentHash);
    }

    input.operation.onProgress({
      flow: "membership",
      stage: "membership_sync",
      message: "Pool access confirmed. Finishing your private transaction",
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await wait(attempt === 0 ? 2_000 : 3_000);
      const retriedResult = await input.execute();
      const retriedHash = transactionHashFrom(retriedResult);
      if (retriedHash) {
        window.localStorage.removeItem(enrollmentKey);
        return retriedHash;
      }
    }

    throw new SppMembershipRequiredError(leaf, {
      accessMode: "syncing",
      adminAddress: policy.admin ?? null,
      enrollmentHash,
    });
  }

  throw new SppMembershipRequiredError(leaf, {
    accessMode:
      policy?.adminInsertOnly === true ? "admin_required" : "unknown",
    adminAddress: policy?.admin ?? null,
  });
}

export async function depositToSppPool(input: SppOperationInput) {
  const amount = parseXlmToStroops(input.amount);
  const maximumDeposit = await getSppMaximumDepositStroops().catch(() => null);
  if (maximumDeposit !== null && amount > maximumDeposit) {
    throw new SppDepositLimitError(maximumDeposit);
  }
  const client = await loadSppClient(input.bridge);
  await acceptCurrentDisclaimer(client, input.address, input.onProgress);
  const identity = await ensurePrivacyIdentity(
    client,
    input.address,
    input.bridge,
    input.onProgress,
  );
  const hash = await executeWithAutomaticMembership({
    client,
    identity,
    operation: input,
    execute: () => executeSppDeposit(client, input, amount),
  });

  return { hash, proofVerified: true as const };
}

export async function privateSendWithSpp(
  input: SppOperationInput & { recipient: string },
) {
  const amount = parseXlmToStroops(input.amount);
  const client = await loadSppClient(input.bridge);
  await acceptCurrentDisclaimer(client, input.address, input.onProgress);
  const identity = await ensurePrivacyIdentity(
    client,
    input.address,
    input.bridge,
    input.onProgress,
  );

  const recipient = await client.lookupRegisteredPublicKey(input.recipient);
  const recipientEntry = recipient?.entry;
  if (!recipientEntry) {
    const syncNote = recipient?.registryFullySynced
      ? ""
      : " Stellar Testnet is still checking recent registrations.";
    throw new Error(
      `This recipient has not set up Private Receiving in Obscura yet.${syncNote}`,
    );
  }

  const hash = await executeWithAutomaticMembership({
    client,
    identity,
    operation: input,
    execute: () =>
      client.executeTransfer(
        SPP_XLM_POOL_ID,
        input.address,
        amount,
        recipientEntry.noteKey,
        recipientEntry.encryptionKey,
        SPP_NETWORK_PASSPHRASE,
        input.onProgress,
      ),
  });
  return { hash, proofVerified: true as const };
}

export async function withdrawFromSppPool(
  input: SppOperationInput & { recipient: string },
) {
  const amount = parseXlmToStroops(input.amount);
  const client = await loadSppClient(input.bridge);
  await acceptCurrentDisclaimer(client, input.address, input.onProgress);
  const identity = await ensurePrivacyIdentity(
    client,
    input.address,
    input.bridge,
    input.onProgress,
  );

  const hash = await executeWithAutomaticMembership({
    client,
    identity,
    operation: input,
    execute: () =>
      client.executeWithdraw(
        SPP_XLM_POOL_ID,
        input.address,
        input.recipient,
        amount,
        SPP_NETWORK_PASSPHRASE,
        input.onProgress,
      ),
  });
  return { hash, proofVerified: true as const };
}
