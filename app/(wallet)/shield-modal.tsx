"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  getSppMaximumDepositStroops,
  SppDepositLimitError,
  SppMembershipRequiredError,
  SppProgress,
} from "./spp-client";
import {
  formatStroops,
  formatStroopsAsXlm,
  parseXlmBalanceToStroops,
  parseXlmToStroops,
} from "./stellar-amount";
import { useWalletConnection } from "./wallet-context";
import { testnetTransactionUrl } from "../config";

type ShieldModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

function formatAssetBalance(value: string) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 7,
  }).format(Number(value));
}

function getShieldErrorMessage(error: unknown) {
  if (error instanceof SppDepositLimitError) {
    return `The official SPP pool allows up to ${formatStroopsAsXlm(error.maximumStroops)} XLM per Shield. Enter a smaller amount.`;
  }

  const message =
    error instanceof Error
      ? error.message
      : "Your XLM could not be made private.";
  const normalized = message.toLowerCase();

  if (normalized.includes("field bigint")) {
    return "Your XLM amount is valid, but Obscura could not prepare your private access details. No funds were moved. Close this window, reconnect your wallet, and try again.";
  }
  if (normalized.includes("insufficient")) {
    return "Your wallet does not have enough spendable XLM for this amount and the network fee.";
  }
  if (
    normalized.includes("reject") ||
    normalized.includes("cancel") ||
    normalized.includes("declin")
  ) {
    return "Wallet approval was cancelled. No funds were moved.";
  }
  if (
    normalized.includes("not authorized") ||
    normalized.includes("contract, #1")
  ) {
    return "The official SPP pool changed to restricted access before setup finished. No funds were moved. Try again to refresh the pool policy.";
  }
  if (
    normalized.includes("transaction simulation failed") ||
    normalized.includes("hosterror") ||
    normalized.includes("event log") ||
    normalized.includes("diagnostic")
  ) {
    return "Stellar rejected this Shield request before wallet approval. No funds were moved. Check the amount and try again.";
  }
  return message;
}

const PROOF_STAGES = [
  { stage: "sync_check", label: "Check that your wallet is ready" },
  { stage: "worker_retry", label: "Warm up the private engine" },
  { stage: "membership_submit", label: "Activate official pool access" },
  { stage: "membership_sync", label: "Confirm your pool access" },
  { stage: "prove", label: "Create a privacy proof in your browser" },
  { stage: "prepare_tx", label: "Prepare your private deposit" },
  { stage: "sign_auth", label: "Approve access in your wallet" },
  { stage: "sign_tx", label: "Approve the transaction" },
  { stage: "submit", label: "Send it to Stellar Testnet" },
  { stage: "confirm", label: "Confirm your private balance" },
];

function stageIndex(stage: string) {
  const aliases: Record<string, string> = {
    fetch_chain_state: "sync_check",
    load_state: "sync_check",
    sync_wait: "sync_check",
  };
  return PROOF_STAGES.findIndex(
    (item) => item.stage === (aliases[stage] ?? stage),
  );
}

export function ShieldModal({ isOpen, onClose }: ShieldModalProps) {
  const {
    address,
    balances,
    connectWallet,
    isConnected,
    isConnecting,
    submitShieldTransaction,
  } = useWalletConnection();
  const [amount, setAmount] = useState("");
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SppProgress | null>(null);
  const [state, setState] = useState<
    "idle" | "working" | "success" | "error" | "membership"
  >("idle");
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [membershipDetails, setMembershipDetails] =
    useState<SppMembershipRequiredError | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [maximumDepositStroops, setMaximumDepositStroops] =
    useState<bigint | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const operationIdRef = useRef(0);

  const xlm = useMemo(
    () => balances.find((asset) => asset.assetCode === "XLM"),
    [balances],
  );
  const isBusy = state === "working";
  const currentStage = stageIndex(progress?.stage ?? "");
  const currentProgressLabel =
    PROOF_STAGES[Math.max(0, currentStage)]?.label ??
    "Preparing your private balance";
  const amountInStroops = useMemo(() => {
    if (!amount.trim()) return null;
    try {
      return parseXlmToStroops(amount);
    } catch {
      return null;
    }
  }, [amount]);

  useEffect(() => {
    operationIdRef.current += 1;
    setAmount("");
    setAcceptedRisk(false);
    setError(null);
    setProgress(null);
    setState("idle");
    setTransactionHash(null);
    setMembershipDetails(null);
    setCopiedCode(false);
  }, [address]);

  useEffect(() => {
    if (!isOpen || !isConnected) {
      setMaximumDepositStroops(null);
      return;
    }

    let active = true;
    void getSppMaximumDepositStroops()
      .then((limit) => {
        if (active) setMaximumDepositStroops(limit);
      })
      .catch(() => {
        if (active) setMaximumDepositStroops(null);
      });

    return () => {
      active = false;
    };
  }, [isConnected, isOpen]);

  useEffect(() => {
    if (!isBusy) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    }, 500);

    return () => window.clearInterval(timer);
  }, [isBusy]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isBusy, isOpen, onClose]);

  const resetAndClose = () => {
    if (isBusy) return;
    setAmount("");
    setAcceptedRisk(false);
    setError(null);
    setProgress(null);
    setState("idle");
    setTransactionHash(null);
    setMembershipDetails(null);
    setCopiedCode(false);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const operationId = ++operationIdRef.current;
    setError(null);
    setMembershipDetails(null);
    setCopiedCode(false);

    let requestedStroops: bigint;
    try {
      requestedStroops = parseXlmToStroops(amount);
    } catch (amountError) {
      setError(getShieldErrorMessage(amountError));
      return;
    }

    if (xlm) {
      try {
        const availableStroops = parseXlmBalanceToStroops(xlm.balance);
        if (requestedStroops > availableStroops) {
          setError(
            `Your available balance is ${formatAssetBalance(xlm.balance)} XLM. Enter a smaller amount and leave a little XLM for the network fee.`,
          );
          return;
        }
      } catch {
        setError("Your current XLM balance could not be read. Refresh it and try again.");
        return;
      }
    }
    if (
      maximumDepositStroops !== null &&
      requestedStroops > maximumDepositStroops
    ) {
      setError(
        `The official SPP pool allows up to ${formatStroopsAsXlm(maximumDepositStroops)} XLM per Shield. Enter a smaller amount.`,
      );
      return;
    }
    if (!acceptedRisk) {
      setError("Please confirm the Testnet notice to continue.");
      return;
    }

    setState("working");
    setProgress({
      flow: "deposit",
      stage: "sync_check",
      message: "Preparing your private balance",
    });

    try {
      const result = await submitShieldTransaction(
        { amount, assetCode: "XLM" },
        (nextProgress) => {
          if (operationIdRef.current === operationId) {
            setProgress(nextProgress);
          }
        },
      );
      if (operationIdRef.current !== operationId) return;
      setTransactionHash(result.hash);
      setState("success");
    } catch (submitError) {
      if (operationIdRef.current !== operationId) return;
      if (submitError instanceof SppMembershipRequiredError) {
        setMembershipDetails(submitError);
        setState("membership");
        return;
      }
      setError(getShieldErrorMessage(submitError));
      setState("error");
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="shield-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) resetAndClose();
          }}
        >
          <motion.section
            aria-labelledby="shield-modal-title"
            aria-modal="true"
            className="shield-modal"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            role="dialog"
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <header className="shield-modal-header">
              <div>
                <span>// MAKE XLM PRIVATE</span>
                <h2 id="shield-modal-title">Shield XLM</h2>
              </div>
              <button
                aria-label="Close shield dialog"
                disabled={isBusy}
                onClick={resetAndClose}
                type="button"
              >
                <X size={20} />
              </button>
            </header>

            {state === "success" && transactionHash ? (
              <div className="shield-success">
                <span className="shield-success-icon">
                  <Check size={28} />
                </span>
                <p className="proof-kicker">// COMPLETE</p>
                <h3>Your XLM Is Now Private</h3>
                <p>
                  {amount} XLM was added to your private balance. You can now
                  send it privately or move it back later.
                </p>
                <strong className="success-proof-note">
                  Privacy proof verified on Stellar
                </strong>
                <a
                  href={testnetTransactionUrl(transactionHash)}
                  rel="noreferrer"
                  target="_blank"
                >
                  View Testnet Transaction
                  <ExternalLink size={16} />
                </a>
                <button onClick={resetAndClose} type="button">
                  Done
                </button>
              </div>
            ) : state === "membership" && membershipDetails ? (
              <div className="shield-membership-state">
                <ShieldCheck size={30} />
                <p className="proof-kicker">
                  {membershipDetails.accessMode === "syncing"
                    ? "// FINISHING SETUP"
                    : membershipDetails.accessMode === "unknown"
                      ? "// ACCESS CHECK INCOMPLETE"
                      : "// OFFICIAL POOL POLICY"}
                </p>
                <h3>
                  {membershipDetails.accessMode === "syncing"
                    ? "Pool Access Is Syncing"
                    : membershipDetails.accessMode === "unknown"
                      ? "Pool Access Could Not Be Confirmed"
                      : "Official Pool Approval Needed"}
                </h3>
                <p>
                  {membershipDetails.accessMode === "syncing"
                    ? "Your wallet added itself to the official SPP Testnet pool. Stellar is still syncing that access. No deposit was submitted yet."
                    : membershipDetails.accessMode === "unknown"
                      ? "Obscura could not read the official SPP pool policy. Your private receiving address is ready and no funds were moved. Check again when Testnet is available."
                      : "Your private receiving address is ready. The existing official SPP Testnet contract currently limits who can enter its privacy pool. Obscura cannot override that contract, and no funds were moved."}
                </p>

                <div className="membership-readiness">
                  <span>
                    <Check size={16} />
                    Private receiving address ready
                  </span>
                  <span>
                    <ShieldCheck size={16} />
                    {membershipDetails.accessMode === "syncing"
                      ? "Pool access submitted"
                      : membershipDetails.accessMode === "unknown"
                        ? "Pool policy temporarily unavailable"
                        : "Pool access controlled by official SPP"}
                  </span>
                </div>

                {membershipDetails.enrollmentHash ? (
                  <a
                    className="membership-explorer-link"
                    href={testnetTransactionUrl(membershipDetails.enrollmentHash)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View Access Transaction
                    <ExternalLink size={15} />
                  </a>
                ) : null}

                <label>
                  Official pool access code
                  <span>
                    <code>{membershipDetails.aspLeaf}</code>
                    <button
                      aria-label="Copy Testnet access code"
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          membershipDetails.aspLeaf,
                        );
                        setCopiedCode(true);
                        window.setTimeout(() => setCopiedCode(false), 1800);
                      }}
                      type="button"
                    >
                      {copiedCode ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </span>
                </label>
                <small>
                  {copiedCode
                    ? "Access code copied."
                    : membershipDetails.accessMode === "syncing"
                      ? "Keep this page open briefly, then check access again."
                      : membershipDetails.accessMode === "unknown"
                        ? "Use Check Access and Continue to refresh the live pool policy."
                      : "Only the official SPP contract owner can approve this code while restricted mode is enabled. This code cannot move your funds or reveal your wallet keys."}
                </small>
                <div className="membership-actions">
                  <button
                    onClick={() => {
                      setState("idle");
                      window.requestAnimationFrame(() =>
                        formRef.current?.requestSubmit(),
                      );
                    }}
                    type="button"
                  >
                    Check Access and Continue
                  </button>
                  <button onClick={resetAndClose} type="button">
                    Back to Dashboard
                  </button>
                </div>
              </div>
            ) : !isConnected ? (
              <div className="shield-connect-state">
                <WalletCards size={34} />
                <h3>Connect Your Wallet</h3>
                <p>Connect the Stellar wallet that holds the XLM you want to make private.</p>
                <button
                  disabled={isConnecting}
                  onClick={connectWallet}
                  type="button"
                >
                  {isConnecting ? "Opening Wallets" : "Connect Wallet"}
                </button>
              </div>
            ) : (
              <form
                className="shield-modal-form"
                onSubmit={handleSubmit}
                ref={formRef}
              >
                <div className="operation-guide operation-guide-dark">
                  <p>// THREE SIMPLE STEPS</p>
                  <ol>
                    <li><strong>1</strong><span>Enter a small amount of XLM.</span></li>
                    <li><strong>2</strong><span>Approve the request in your wallet.</span></li>
                    <li><strong>3</strong><span>Use your new private balance.</span></li>
                  </ol>
                </div>

                <label>
                  <span>Asset</span>
                  <select value="XLM" disabled>
                    <option value="XLM">
                      XLM  {xlm ? `${formatAssetBalance(xlm.balance)} available` : "Stellar Testnet"}
                    </option>
                  </select>
                  <small>This amount comes from your connected wallet.</small>
                </label>

                <label>
                  <span>Amount to make private</span>
                  <div className="shield-amount-field">
                    <input
                      autoFocus
                      inputMode="decimal"
                      max={
                        maximumDepositStroops === null
                          ? xlm?.balance
                          : formatStroopsAsXlm(maximumDepositStroops)
                      }
                      min="0"
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0.00"
                      step="0.0000001"
                      type="number"
                      value={amount}
                    />
                  </div>
                  {amountInStroops ? (
                    <small>
                      {amount} XLM equals {formatStroops(amountInStroops)} stroops.
                      {maximumDepositStroops !== null
                        ? ` Maximum per Shield: ${formatStroopsAsXlm(maximumDepositStroops)} XLM.`
                        : ""}
                    </small>
                  ) : (
                    <small>Use up to 7 decimal places. The minimum is 0.0000001 XLM.</small>
                  )}
                </label>

                <div className="shield-intent-note">
                  <ShieldCheck size={19} />
                  <p>
                    Obscura creates a hidden receipt called a private
                    note. It proves the XLM is yours without showing your
                    private balance to other people.
                  </p>
                </div>

                <label className="spp-consent">
                  <input
                    checked={acceptedRisk}
                    disabled={isBusy}
                    onChange={(event) => setAcceptedRisk(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    I understand this is experimental Testnet software and will
                    use a small amount.
                  </span>
                </label>

                {isBusy ? (
                  <div className="proof-progress" aria-live="polite">
                    <div className="proof-progress-current">
                      <LoaderCircle className="spin" size={17} />
                      <div>
                        <span>{currentProgressLabel}</span>
                        <small>
                          {elapsedSeconds} seconds elapsed | Keep this window open
                        </small>
                      </div>
                    </div>
                    <ol>
                      {PROOF_STAGES.map((item, index) => (
                        <li
                          className={
                            index < currentStage
                              ? "proof-stage-done"
                              : index === currentStage
                                ? "proof-stage-active"
                                : ""
                          }
                          key={item.stage}
                        >
                          <span>{index < currentStage ? <Check size={12} /> : index + 1}</span>
                          {item.label}
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {error ? (
                  <p aria-live="assertive" className="shield-form-error">
                    {error}
                  </p>
                ) : null}

                <button
                  className="shield-submit"
                  disabled={isBusy || !xlm || !acceptedRisk}
                  type="submit"
                >
                  {isBusy ? (
                    <LoaderCircle className="spin" size={19} />
                  ) : (
                    <ShieldCheck size={19} />
                  )}
                  {isBusy ? "Making XLM Private" : "Make XLM Private"}
                </button>
              </form>
            )}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
