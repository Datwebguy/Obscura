"use client";

import { motion } from "framer-motion";
import {
  Check,
  ExternalLink,
  HelpCircle,
  LoaderCircle,
  LockKeyhole,
  Send,
  Undo2,
  WalletCards,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { SppProgress } from "./spp-client";
import { RegistrationPanel } from "./registration-panel";
import { useWalletConnection } from "./wallet-context";
import { testnetTransactionUrl } from "../config";

type PrivacyOperationFormProps = {
  mode: "send" | "unshield";
};

const stageNames: Record<string, string> = {
  confirm: "Confirming your private payment on Stellar",
  derive_keys: "Preparing your private balance",
  fetch_chain_state: "Checking your private balance",
  load_state: "Finding the funds to use",
  prepare_tx: "Preparing the payment",
  prove: "Creating a privacy proof in your browser",
  sign_auth: "Waiting for wallet approval",
  sign_tx: "Please approve the transaction in your wallet",
  submit: "Sending the transaction to Stellar Testnet",
  sync_check: "Checking that everything is ready",
  sync_wait: "Finishing a network update",
};

function privateOperationError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "The private payment could not be completed.";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("transaction simulation failed") ||
    normalized.includes("hosterror") ||
    normalized.includes("event log") ||
    normalized.includes("diagnostic")
  ) {
    return "Stellar rejected this request before wallet approval. No funds were moved. Check the amount and destination, then try again.";
  }
  return message;
}

export function PrivacyOperationForm({ mode }: PrivacyOperationFormProps) {
  const {
    address,
    connectWallet,
    isConnected,
    isConnecting,
    submitPrivateSend,
    submitUnshield,
  } = useWalletConnection();
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [progress, setProgress] = useState<SppProgress | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const isSend = mode === "send";
  const Icon = isSend ? Send : Undo2;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setHash(null);

    if (!acceptedRisk) {
      setError("Please confirm the Testnet notice to continue.");
      return;
    }

    setIsWorking(true);
    setProgress({
      flow: mode,
      stage: "sync_check",
      message: "Preparing your private payment",
    });
    try {
      const destination = recipient.trim() || (!isSend ? address : null);
      if (!destination) throw new Error("Enter the recipient Stellar address.");
      const action = isSend ? submitPrivateSend : submitUnshield;
      const result = await action(
        { amount, recipient: destination },
        setProgress,
      );
      setHash(result.hash);
      setProgress({
        flow: mode,
        stage: "confirm",
        message: "Privacy proof verified on Stellar",
      });
    } catch (operationError) {
      setError(privateOperationError(operationError));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <motion.section
      className="wallet-form-page"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="wallet-section-heading">
        <p>{isSend ? "// PRIVATE SEND" : "// UNSHIELD"}</p>
        <h1>{isSend ? "Send Privately" : "Move XLM Back"}</h1>
        <span className="wallet-heading-copy">
          {isSend
            ? "Send XLM from your private balance. The payment details stay private."
            : "Move XLM from your private balance to a public Stellar wallet."}
        </span>
      </div>

      {!isConnected ? (
        <div className="wallet-form-card privacy-connect-card">
          <WalletCards size={30} />
          <h2>Connect Your Wallet</h2>
          <p>Connect the Stellar wallet you want to use with Obscura.</p>
          <button disabled={isConnecting} onClick={connectWallet} type="button">
            {isConnecting ? "Opening Wallets" : "Connect Wallet"}
          </button>
        </div>
      ) : hash ? (
        <div className="wallet-form-card operation-success-card">
          <span><Check size={25} /></span>
          <p>// COMPLETE</p>
          <h2>{isSend ? "Private Payment Sent" : "XLM Moved Back"}</h2>
          <p>
            {isSend
              ? `${amount} XLM was sent from your private balance. The public transaction does not reveal the private payment details.`
              : `${amount} XLM was moved from your private balance to the selected Stellar wallet.`}
          </p>
          {isSend ? (
            <div className="operation-receive-note">
              <LockKeyhole size={18} />
              <div>
                <strong>Where the recipient sees it</strong>
                <span>
                  They must connect this recipient wallet in Obscura and unlock
                  their Private Balance. It will not appear in their public
                  Freighter XLM balance.
                </span>
              </div>
            </div>
          ) : null}
          <strong className="success-proof-note">
            Privacy proof verified on Stellar
          </strong>
          <a
            href={testnetTransactionUrl(hash)}
            rel="noreferrer"
            target="_blank"
          >
            View Testnet Transaction
            <ExternalLink size={16} />
          </a>
          <button
            onClick={() => {
              setHash(null);
              setAmount("");
              setProgress(null);
            }}
            type="button"
          >
            Start Another
          </button>
        </div>
      ) : (
        <form className="wallet-form-card privacy-operation-card" onSubmit={submit}>
          <div className="operation-guide">
            <p>// THREE SIMPLE STEPS</p>
            <ol>
              {isSend ? (
                <>
                  <li><strong>1</strong><span>Paste the recipient&apos;s Stellar address.</span></li>
                  <li><strong>2</strong><span>Enter how much private XLM to send.</span></li>
                  <li><strong>3</strong><span>Approve the request in your wallet.</span></li>
                </>
              ) : (
                <>
                  <li><strong>1</strong><span>Choose where the public XLM should go.</span></li>
                  <li><strong>2</strong><span>Enter how much to move back.</span></li>
                  <li><strong>3</strong><span>Approve the request in your wallet.</span></li>
                </>
              )}
            </ol>
          </div>

          <label>
            <span className="field-label-with-help">
              {isSend ? "Recipient's Stellar address" : "Destination wallet"}
              {isSend ? (
                <span
                  className="help-tip"
                  data-tooltip="Ask the recipient to set up Private Receiving in Obscura once. That lets the payment find their private address."
                  tabIndex={0}
                >
                  <HelpCircle aria-label="Why must the recipient set up private receiving?" size={16} />
                </span>
              ) : null}
            </span>
            <input
              autoCapitalize="none"
              autoComplete="off"
              onChange={(event) => setRecipient(event.target.value.trim())}
              placeholder={isSend ? "Paste their G... address" : address ?? "G..."}
              spellCheck={false}
              value={recipient}
            />
            <small>
              {isSend
                ? "The recipient needs to set up Private Receiving once before you can pay them privately."
                : "Leave this empty to send the XLM back to your connected wallet."}
            </small>
          </label>
          <label>
            Asset
            <select value="XLM" disabled>
              <option value="XLM">XLM on Stellar Testnet</option>
            </select>
          </label>
          <label>
            {isSend ? "Amount to send" : "Amount to move back"}
            <input
              inputMode="decimal"
              min="0"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              step="0.0000001"
              type="number"
              value={amount}
            />
          </label>

          <label className="spp-consent">
            <input
              checked={acceptedRisk}
              disabled={isWorking}
              onChange={(event) => setAcceptedRisk(event.target.checked)}
              type="checkbox"
            />
            <span>
              I understand this is experimental Testnet software and will use
              a small amount.
            </span>
          </label>

          {isWorking ? (
            <div className="operation-live-status" aria-live="polite">
              <LoaderCircle className="spin" size={18} />
              <div>
                <strong>{stageNames[progress?.stage ?? ""] ?? "Protecting your payment"}</strong>
                <span>This can take a moment. Keep this page open.</span>
              </div>
            </div>
          ) : null}

          {error ? <p className="shield-form-error">{error}</p> : null}

          <button disabled={isWorking || !acceptedRisk} type="submit">
            {isWorking ? <LoaderCircle className="spin" size={18} /> : <Icon size={18} />}
            {isWorking
              ? "Protecting Your Payment"
              : isSend
                ? "Send Privately"
                : "Move XLM Back"}
          </button>
        </form>
      )}

      {isConnected && isSend ? <RegistrationPanel compact /> : null}

      <div className="wallet-info-strip">
        <LockKeyhole size={18} />
        A private note is a hidden receipt that proves the XLM belongs to you
        without showing your private balance to other people.
      </div>
    </motion.section>
  );
}
