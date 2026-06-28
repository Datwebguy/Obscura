"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  checkSppRegistration,
  depositToSppPool,
  getSppPrivatePortfolio,
  privateSendWithSpp,
  registerSppWallet,
  SPP_NETWORK_PASSPHRASE,
  SppProgress,
  SppPrivateBalance,
  SppRegistrationState,
  SppWalletBridge,
  withdrawFromSppPool,
} from "./spp-client";
import { obscuraConfig } from "../config";

const HORIZON_URL = obscuraConfig.horizonUrl;
const NETWORK_NAME = "Testnet";
const VERIFIED_PROOF_STORAGE_PREFIX = "obscura:last-verified-proof:";
const UNSCOPED_VERIFIED_PROOF_STORAGE_KEY = "obscura:last-verified-proof";
const LEGACY_VERIFIED_PROOF_STORAGE_KEY =
  `${["stellar", "shield"].join("-")}:last-verified-proof`;

type WalletKitClass =
  typeof import("@creit.tech/stellar-wallets-kit/sdk").StellarWalletsKit;
type KitEventTypes =
  typeof import("@creit.tech/stellar-wallets-kit/types").KitEventType;
type KitThemes = Pick<
  typeof import("@creit.tech/stellar-wallets-kit/types"),
  "SwkAppDarkTheme" | "SwkAppLightTheme"
>;

type WalletRuntime = {
  Kit: WalletKitClass;
  eventTypes: KitEventTypes;
  themes: KitThemes;
};

export type StellarBalance = {
  assetCode: string;
  assetIssuer?: string;
  assetType: string;
  balance: string;
};

export type ShieldTransactionResult = {
  hash: string;
  proofVerified: true;
};

export type VerifiedProof = {
  hash: string;
  verifiedAt: string;
};

export type PrivacyRegistrationStatus =
  | "disconnected"
  | "checking"
  | SppRegistrationState
  | "error";

export type PrivateBalanceStatus =
  | "disconnected"
  | "checking"
  | "locked"
  | "ready"
  | "error";

type ShieldTransactionInput = {
  amount: string;
  assetCode: string;
};

type PrivateTransactionInput = {
  amount: string;
  recipient: string;
};

type WalletContextValue = {
  address: string | null;
  balances: StellarBalance[];
  balanceError: string | null;
  error: string | null;
  isBalanceLoading: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isRegistering: boolean;
  nativeBalance: string | null;
  privateBalances: SppPrivateBalance[];
  privateBalanceError: string | null;
  privateBalanceStatus: PrivateBalanceStatus;
  network: typeof NETWORK_NAME;
  lastVerifiedProof: VerifiedProof | null;
  registrationError: string | null;
  registrationHash: string | null;
  registrationStatus: PrivacyRegistrationStatus;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  refreshPrivateBalances: () => Promise<void>;
  refreshRegistration: () => Promise<void>;
  registerWallet: (
    onStatus?: (status: SppProgress) => void,
  ) => Promise<{ hash: string }>;
  unlockPrivateBalance: (
    onStatus?: (status: SppProgress) => void,
  ) => Promise<void>;
  submitShieldTransaction: (
    input: ShieldTransactionInput,
    onStatus: (status: SppProgress) => void,
  ) => Promise<ShieldTransactionResult>;
  submitPrivateSend: (
    input: PrivateTransactionInput,
    onStatus: (status: SppProgress) => void,
  ) => Promise<ShieldTransactionResult>;
  submitUnshield: (
    input: PrivateTransactionInput,
    onStatus: (status: SppProgress) => void,
  ) => Promise<ShieldTransactionResult>;
};

type HorizonBalance = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
};

type HorizonAccount = {
  balances: HorizonBalance[];
};

const WalletContext = createContext<WalletContextValue | null>(null);
let walletRuntimePromise: Promise<WalletRuntime> | null = null;

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return String(error.message);
  }
  return "The wallet request could not be completed.";
}

function verifiedProofStorageKey(address: string) {
  return `${VERIFIED_PROOF_STORAGE_PREFIX}${address}`;
}

async function getWalletRuntime() {
  if (!walletRuntimePromise) {
    walletRuntimePromise = Promise.all([
      import("@creit.tech/stellar-wallets-kit/sdk"),
      import("@creit.tech/stellar-wallets-kit/modules/freighter"),
      import("@creit.tech/stellar-wallets-kit/modules/hana"),
      import("@creit.tech/stellar-wallets-kit/modules/klever"),
      import("@creit.tech/stellar-wallets-kit/modules/onekey"),
      import("@creit.tech/stellar-wallets-kit/modules/cactuslink"),
      import("@creit.tech/stellar-wallets-kit/types"),
    ]).then(([sdk, freighter, hana, klever, onekey, cactuslink, types]) => {
      sdk.StellarWalletsKit.init({
        // SPP needs transaction, message, and Soroban auth-entry signing.
        // Only show wallets that implement all three operations.
        modules: [
          new freighter.FreighterModule(),
          new hana.HanaModule(),
          new klever.KleverModule(),
          new onekey.OneKeyModule(),
          new cactuslink.CactusLinkModule(),
        ],
        network: types.Networks.TESTNET,
        authModal: {
          hideUnsupportedWallets: false,
          showInstallLabel: true,
        },
      });

      return {
        Kit: sdk.StellarWalletsKit,
        eventTypes: types.KitEventType,
        themes: {
          SwkAppDarkTheme: types.SwkAppDarkTheme,
          SwkAppLightTheme: types.SwkAppLightTheme,
        },
      };
    });
  }

  return walletRuntimePromise;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balances, setBalances] = useState<StellarBalance[]>([]);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [privateBalances, setPrivateBalances] = useState<SppPrivateBalance[]>(
    [],
  );
  const [privateBalanceError, setPrivateBalanceError] = useState<string | null>(
    null,
  );
  const [privateBalanceStatus, setPrivateBalanceStatus] =
    useState<PrivateBalanceStatus>("disconnected");
  const [registrationError, setRegistrationError] = useState<string | null>(
    null,
  );
  const [registrationHash, setRegistrationHash] = useState<string | null>(null);
  const [registrationStatus, setRegistrationStatus] =
    useState<PrivacyRegistrationStatus>("disconnected");
  const [lastVerifiedProof, setLastVerifiedProof] =
    useState<VerifiedProof | null>(null);
  const addressRef = useRef<string | null>(null);
  const balanceRequestIdRef = useRef(0);
  const walletSessionIdRef = useRef(0);

  useEffect(() => {
    window.localStorage.removeItem(UNSCOPED_VERIFIED_PROOF_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_VERIFIED_PROOF_STORAGE_KEY);
  }, []);

  const selectWalletAddress = useCallback((nextAddress: string | null) => {
    if (addressRef.current !== nextAddress) {
      walletSessionIdRef.current += 1;
      balanceRequestIdRef.current += 1;
      setBalances([]);
      setBalanceError(null);
      setIsBalanceLoading(false);
      setPrivateBalances([]);
      setPrivateBalanceError(null);
      setPrivateBalanceStatus(nextAddress ? "checking" : "disconnected");
      setRegistrationError(null);
      setRegistrationHash(null);
      setRegistrationStatus(nextAddress ? "checking" : "disconnected");
      setLastVerifiedProof(null);
      setIsRegistering(false);
    }
    addressRef.current = nextAddress;
    setAddress(nextAddress);
  }, []);

  const loadBalances = useCallback(async (publicKey: string) => {
    const requestId = ++balanceRequestIdRef.current;
    const walletSessionId = walletSessionIdRef.current;
    setIsBalanceLoading(true);
    setBalanceError(null);

    try {
      const response = await fetch(`${HORIZON_URL}/accounts/${publicKey}`, {
        cache: "no-store",
      });

      if (response.status === 404) {
        throw new Error("This account is not funded on Stellar Testnet.");
      }
      if (!response.ok) {
        throw new Error("Stellar Testnet balance is temporarily unavailable.");
      }

      const account = (await response.json()) as HorizonAccount;
      const nextBalances = account.balances
        .map((item) => ({
          assetCode: item.asset_type === "native" ? "XLM" : (item.asset_code ?? "ASSET"),
          assetIssuer: item.asset_issuer,
          assetType: item.asset_type,
          balance: item.balance,
        }))
        .sort((left, right) => {
          if (left.assetType === "native") return -1;
          if (right.assetType === "native") return 1;
          return left.assetCode.localeCompare(right.assetCode);
        });

      if (
        requestId === balanceRequestIdRef.current &&
        addressRef.current === publicKey &&
        walletSessionIdRef.current === walletSessionId
      ) {
        setBalances(nextBalances);
      }
    } catch (requestError) {
      if (
        requestId === balanceRequestIdRef.current &&
        addressRef.current === publicKey &&
        walletSessionIdRef.current === walletSessionId
      ) {
        setBalances([]);
        setBalanceError(getErrorMessage(requestError));
      }
    } finally {
      if (
        requestId === balanceRequestIdRef.current &&
        addressRef.current === publicKey &&
        walletSessionIdRef.current === walletSessionId
      ) {
        setIsBalanceLoading(false);
      }
    }
  }, []);

  const refreshBalances = useCallback(async () => {
    if (addressRef.current) {
      await loadBalances(addressRef.current);
    }
  }, [loadBalances]);

  useEffect(() => {
    let active = true;
    const cleanups: Array<() => void> = [];

    void getWalletRuntime()
      .then(({ Kit, eventTypes }) => {
        if (!active) return;

        cleanups.push(
          Kit.on(eventTypes.STATE_UPDATED, (event) => {
            if (!active) return;
            const nextAddress = event.payload.address ?? null;
            selectWalletAddress(nextAddress);
            setError(null);
          }),
          Kit.on(eventTypes.DISCONNECT, () => {
            if (!active) return;
            selectWalletAddress(null);
          }),
        );

        void Kit.getAddress()
          .then(({ address: storedAddress }) => {
            if (!active) return;
            selectWalletAddress(storedAddress);
          })
          .catch(() => undefined);
      })
      .catch((runtimeError) => {
        if (active) setError(getErrorMessage(runtimeError));
      });

    return () => {
      active = false;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [selectWalletAddress]);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const { Kit, themes } = await getWalletRuntime();
      Kit.setTheme(
        document.documentElement.dataset.theme === "dark"
          ? themes.SwkAppDarkTheme
          : themes.SwkAppLightTheme,
      );
      const result = await Kit.authModal();
      selectWalletAddress(result.address);
    } catch (connectionError) {
      const message = getErrorMessage(connectionError);
      if (!message.toLowerCase().includes("closed the modal")) {
        setError(message);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [selectWalletAddress]);

  const disconnectWallet = useCallback(async () => {
    try {
      const { Kit } = await getWalletRuntime();
      await Kit.disconnect();
    } finally {
      selectWalletAddress(null);
      setError(null);
    }
  }, [selectWalletAddress]);

  const createWalletBridge = useCallback(
    async (requestedAddress?: string): Promise<SppWalletBridge> => {
      const { Kit } = await getWalletRuntime();
      const publicKey = requestedAddress ?? addressRef.current;
      if (!publicKey) throw new Error("Connect a Stellar wallet before signing.");

      return {
        signAuthEntry: async (authEntry, options) => {
          const result = await Kit.signAuthEntry(authEntry, {
            address: publicKey,
            networkPassphrase: SPP_NETWORK_PASSPHRASE,
            ...options,
          });
          if (!result.signedAuthEntry) {
            throw new Error("The wallet did not return a signed authorization.");
          }
          return result.signedAuthEntry;
        },
        signMessage: async (message, options) => {
          const result = await Kit.signMessage(message, {
            address: publicKey,
            networkPassphrase: SPP_NETWORK_PASSPHRASE,
            ...options,
          });
          if (!result.signedMessage) {
            throw new Error("The wallet did not return a message signature.");
          }
          return result.signedMessage;
        },
        signTransaction: async (transactionXdr, options) => {
          const result = await Kit.signTransaction(transactionXdr, {
            address: publicKey,
            networkPassphrase: SPP_NETWORK_PASSPHRASE,
            ...options,
          });
          if (!result.signedTxXdr) {
            throw new Error("The wallet did not return a signed transaction.");
          }
          return result.signedTxXdr;
        },
      };
    },
    [],
  );

  const loadPrivateBalances = useCallback(
    async (
      publicKey: string,
      unlock = false,
      onStatus?: (status: SppProgress) => void,
    ) => {
      const walletSessionId = walletSessionIdRef.current;
      if (unlock) setPrivateBalanceStatus("checking");
      setPrivateBalanceError(null);

      try {
        const result = await getSppPrivatePortfolio({
          address: publicKey,
          bridge: await createWalletBridge(publicKey),
          onProgress: onStatus,
          unlock,
        });
        if (
          addressRef.current !== publicKey ||
          walletSessionIdRef.current !== walletSessionId
        ) return;

        setPrivateBalances(result.balances);
        setPrivateBalanceStatus(result.needsUnlock ? "locked" : "ready");
      } catch (portfolioError) {
        if (
          addressRef.current !== publicKey ||
          walletSessionIdRef.current !== walletSessionId
        ) return;
        setPrivateBalanceError(getErrorMessage(portfolioError));
        setPrivateBalanceStatus("error");
      }
    },
    [createWalletBridge],
  );

  const refreshPrivateBalances = useCallback(async () => {
    if (privateBalanceStatus === "error") {
      window.location.reload();
      return;
    }
    const publicKey = addressRef.current;
    if (publicKey) {
      setPrivateBalanceStatus("checking");
      await loadPrivateBalances(publicKey);
    }
  }, [loadPrivateBalances, privateBalanceStatus]);

  const unlockPrivateBalance = useCallback(
    async (onStatus?: (status: SppProgress) => void) => {
      const publicKey = addressRef.current;
      if (!publicKey) {
        throw new Error("Connect your Stellar wallet before unlocking.");
      }
      await loadPrivateBalances(publicKey, true, onStatus);
    },
    [loadPrivateBalances],
  );

  const loadRegistration = useCallback(
    async (publicKey: string) => {
      const walletSessionId = walletSessionIdRef.current;
      setRegistrationStatus("checking");
      setRegistrationError(null);

      try {
        const status = await checkSppRegistration({
          address: publicKey,
          bridge: await createWalletBridge(publicKey),
        });
        if (
          addressRef.current === publicKey &&
          walletSessionIdRef.current === walletSessionId
        ) setRegistrationStatus(status);
      } catch (registrationRequestError) {
        if (
          addressRef.current !== publicKey ||
          walletSessionIdRef.current !== walletSessionId
        ) return;
        setRegistrationStatus("error");
        setRegistrationError(getErrorMessage(registrationRequestError));
      }
    },
    [createWalletBridge],
  );

  const refreshRegistration = useCallback(async () => {
    if (registrationStatus === "error") {
      window.location.reload();
      return;
    }
    if (addressRef.current) await loadRegistration(addressRef.current);
  }, [loadRegistration, registrationStatus]);

  useEffect(() => {
    balanceRequestIdRef.current += 1;
    setBalances([]);
    setBalanceError(null);
    setRegistrationHash(null);
    setRegistrationError(null);
    setPrivateBalances([]);
    setPrivateBalanceError(null);
    setLastVerifiedProof(null);

    if (!address) {
      setRegistrationStatus("disconnected");
      setPrivateBalanceStatus("disconnected");
      return;
    }

    addressRef.current = address;
    try {
      const stored = window.localStorage.getItem(
        verifiedProofStorageKey(address),
      );
      if (stored) setLastVerifiedProof(JSON.parse(stored) as VerifiedProof);
    } catch {
      window.localStorage.removeItem(verifiedProofStorageKey(address));
    }

    void loadBalances(address);
    setPrivateBalanceStatus("checking");
    void loadRegistration(address);
    void loadPrivateBalances(address);
  }, [address, loadBalances, loadPrivateBalances, loadRegistration]);

  useEffect(() => {
    if (!address || privateBalanceStatus !== "ready") return;
    const timer = window.setInterval(() => {
      void loadPrivateBalances(address);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [address, loadPrivateBalances, privateBalanceStatus]);

  const registerWallet = useCallback(
    async (onStatus?: (status: SppProgress) => void) => {
      const publicKey = addressRef.current;
      if (!publicKey) {
        throw new Error("Connect your Stellar wallet before registering.");
      }

      setIsRegistering(true);
      setRegistrationError(null);
      const walletSessionId = walletSessionIdRef.current;
      try {
        const result = await registerSppWallet({
          address: publicKey,
          bridge: await createWalletBridge(publicKey),
          onProgress: onStatus,
        });
        if (
          addressRef.current === publicKey &&
          walletSessionIdRef.current === walletSessionId
        ) {
          setRegistrationHash(result.hash);
          setRegistrationStatus("registered");
        }
        return result;
      } catch (registrationRequestError) {
        const message = getErrorMessage(registrationRequestError);
        if (
          addressRef.current === publicKey &&
          walletSessionIdRef.current === walletSessionId
        ) {
          setRegistrationStatus("unregistered");
          setRegistrationError(message);
        }
        throw registrationRequestError;
      } finally {
        if (
          addressRef.current === publicKey &&
          walletSessionIdRef.current === walletSessionId
        ) setIsRegistering(false);
      }
    },
    [createWalletBridge],
  );

  const rememberVerifiedProof = useCallback((address: string, hash: string) => {
    const proof = { hash, verifiedAt: new Date().toISOString() };
    window.localStorage.setItem(
      verifiedProofStorageKey(address),
      JSON.stringify(proof),
    );
    if (addressRef.current === address) setLastVerifiedProof(proof);
  }, []);

  const submitShieldTransaction = useCallback(
    async (
      { amount, assetCode }: ShieldTransactionInput,
      onStatus: (status: SppProgress) => void,
    ) => {
      const publicKey = addressRef.current;
      if (!publicKey) throw new Error("Connect a Stellar wallet before signing.");
      if (assetCode !== "XLM") {
        throw new Error("The official SPP Testnet deployment currently supports XLM and EURC, not USDC.");
      }

      const bridge = await createWalletBridge(publicKey);
      const result = await depositToSppPool({
        address: publicKey,
        amount,
        bridge,
        onProgress: onStatus,
      });
      rememberVerifiedProof(publicKey, result.hash);
      await loadBalances(publicKey);
      await loadPrivateBalances(publicKey);
      return result;
    },
    [
      createWalletBridge,
      loadBalances,
      loadPrivateBalances,
      rememberVerifiedProof,
    ],
  );

  const submitPrivateSend = useCallback(
    async (
      { amount, recipient }: PrivateTransactionInput,
      onStatus: (status: SppProgress) => void,
    ) => {
      const publicKey = addressRef.current;
      if (!publicKey) throw new Error("Connect a Stellar wallet before signing.");
      const StellarSdk = await import("@stellar/stellar-sdk");
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(recipient)) {
        throw new Error("Enter a valid Stellar public key beginning with G.");
      }

      const result = await privateSendWithSpp({
        address: publicKey,
        amount,
        bridge: await createWalletBridge(publicKey),
        onProgress: onStatus,
        recipient,
      });
      rememberVerifiedProof(publicKey, result.hash);
      await loadPrivateBalances(publicKey);
      return result;
    },
    [createWalletBridge, loadPrivateBalances, rememberVerifiedProof],
  );

  const submitUnshield = useCallback(
    async (
      { amount, recipient }: PrivateTransactionInput,
      onStatus: (status: SppProgress) => void,
    ) => {
      const publicKey = addressRef.current;
      if (!publicKey) throw new Error("Connect a Stellar wallet before signing.");
      const StellarSdk = await import("@stellar/stellar-sdk");
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(recipient)) {
        throw new Error("Enter a valid Stellar public key beginning with G.");
      }

      const result = await withdrawFromSppPool({
        address: publicKey,
        amount,
        bridge: await createWalletBridge(publicKey),
        onProgress: onStatus,
        recipient,
      });
      rememberVerifiedProof(publicKey, result.hash);
      await loadBalances(publicKey);
      await loadPrivateBalances(publicKey);
      return result;
    },
    [
      createWalletBridge,
      loadBalances,
      loadPrivateBalances,
      rememberVerifiedProof,
    ],
  );

  const nativeBalance = useMemo(
    () => balances.find((item) => item.assetType === "native")?.balance ?? null,
    [balances],
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      balances,
      balanceError,
      error,
      isBalanceLoading,
      isConnected: Boolean(address),
      isConnecting,
      isRegistering,
      nativeBalance,
      privateBalances,
      privateBalanceError,
      privateBalanceStatus,
      network: NETWORK_NAME,
      lastVerifiedProof,
      registrationError,
      registrationHash,
      registrationStatus,
      connectWallet,
      disconnectWallet,
      refreshBalances,
      refreshPrivateBalances,
      refreshRegistration,
      registerWallet,
      submitPrivateSend,
      submitShieldTransaction,
      submitUnshield,
      unlockPrivateBalance,
    }),
    [
      address,
      balances,
      balanceError,
      connectWallet,
      disconnectWallet,
      error,
      isBalanceLoading,
      isConnecting,
      isRegistering,
      lastVerifiedProof,
      nativeBalance,
      privateBalances,
      privateBalanceError,
      privateBalanceStatus,
      registrationError,
      registrationHash,
      registrationStatus,
      refreshBalances,
      refreshPrivateBalances,
      refreshRegistration,
      registerWallet,
      submitPrivateSend,
      submitShieldTransaction,
      submitUnshield,
      unlockPrivateBalance,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletConnection() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWalletConnection must be used inside WalletProvider");
  }
  return context;
}
