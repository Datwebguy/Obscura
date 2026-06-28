"use client";

import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  LoaderCircle,
  RefreshCw,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SppProgress } from "./spp-client";
import { useWalletConnection } from "./wallet-context";
import { testnetTransactionUrl } from "../config";

type RegistrationPanelProps = {
  compact?: boolean;
  showPoolNote?: boolean;
};

const REGISTRATION_INTENT_KEY = "obscura:registration-intent";

const progressLabels: Record<string, string> = {
  confirm: "Confirming your private receiving address",
  derive_keys: "Creating your private receiving details",
  prepare_tx: "Preparing your private receiving address",
  sign_tx: "Waiting for your wallet approval",
  submit: "Publishing your privacy address",
};

function friendlyRegistrationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("reject") || message.includes("cancel")) {
    return "Setup was cancelled. No changes were made.";
  }
  return "Private receiving setup did not finish. Check your wallet and try again.";
}

export function RegistrationPanel({
  compact = false,
  showPoolNote = false,
}: RegistrationPanelProps) {
  const {
    connectWallet,
    isConnected,
    isConnecting,
    isRegistering,
    refreshRegistration,
    registerWallet,
    registrationHash,
    registrationStatus,
  } = useWalletConnection();
  const [progress, setProgress] = useState<SppProgress | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const register = useCallback(async () => {
    setActionError(null);
    setProgress({
      flow: "register",
      stage: "prepare_tx",
      message: "Preparing your privacy address",
    });
    try {
      await registerWallet(setProgress);
    } catch (error) {
      setActionError(friendlyRegistrationError(error));
    }
  }, [registerWallet]);

  useEffect(() => {
    const shouldResume =
      window.sessionStorage.getItem(REGISTRATION_INTENT_KEY) === "register";
    if (!shouldResume || !isConnected || isRegistering) return;

    if (registrationStatus === "registered") {
      window.sessionStorage.removeItem(REGISTRATION_INTENT_KEY);
      return;
    }

    if (registrationStatus === "unregistered") {
      window.sessionStorage.removeItem(REGISTRATION_INTENT_KEY);
      void register();
      return;
    }

    if (registrationStatus === "error") {
      window.sessionStorage.removeItem(REGISTRATION_INTENT_KEY);
      setActionError(
        "Private mailbox setup could not start. Please reload the page and try once more.",
      );
    }
  }, [
    isConnected,
    isRegistering,
    register,
    registrationStatus,
  ]);

  const startRegistration = () => {
    if (registrationStatus === "error") {
      window.sessionStorage.setItem(REGISTRATION_INTENT_KEY, "register");
      window.location.reload();
      return;
    }
    void register();
  };

  const status = {
    checking: {
      icon: LoaderCircle,
      label: "Checking private receiving",
      copy: "Looking for your privacy address on Testnet.",
      tone: "checking",
    },
    disconnected: {
      icon: WalletCards,
      label: "Connect to get started",
      copy: "Connect the Stellar wallet you want to use privately.",
      tone: "neutral",
    },
    error: {
      icon: AlertCircle,
      label: "Receiving setup unavailable",
      copy: "We could not open your private mailbox setup. Your funds are safe.",
      tone: "warning",
    },
    registered: {
      icon: CheckCircle2,
      label: "Private Address Ready",
      copy: "People can now find your private receiving address before paying you.",
      tone: "success",
    },
    syncing: {
      icon: RefreshCw,
      label: "Still checking",
      copy: "Stellar Testnet is taking a little longer to confirm your setup.",
      tone: "checking",
    },
    unregistered: {
      icon: AlertCircle,
      label: "Set Up Private Receiving",
      copy: "Create your private receiving address with one wallet approval.",
      tone: "warning",
    },
  }[registrationStatus];
  const StatusIcon = status.icon;
  const canRegister =
    isConnected &&
    registrationStatus === "unregistered";

  return (
    <section
      className={`registration-panel registration-panel-${status.tone}${compact ? " registration-panel-compact" : ""}`}
      aria-labelledby={compact ? undefined : "privacy-registration-title"}
    >
      <div className="registration-panel-copy">
        <span className="registration-status-icon">
          <StatusIcon
            className={
              registrationStatus === "checking" || isRegistering ? "spin" : ""
            }
            size={21}
          />
        </span>
        <div>
          {!compact ? <p>// PRIVATE ADDRESS SETUP</p> : null}
          <h2 id={compact ? undefined : "privacy-registration-title"}>
            {status.label}
          </h2>
          <span>{status.copy}</span>
        </div>
        <span
          className="help-tip"
          data-tooltip="This setup publishes a private receiving address for your wallet. It does not reveal your wallet secrets or move your money."
          tabIndex={0}
        >
          <HelpCircle aria-label="What does registration mean?" size={17} />
        </span>
      </div>

      {!compact ? (
        <p className="registration-explainer">
          Think of it as adding a private mailbox to your Stellar wallet.
          People can send to the mailbox, but they cannot see inside it or
          control your money. This is separate from access to the official SPP
          privacy pool.
        </p>
      ) : null}

      {isRegistering ? (
        <div className="registration-progress" aria-live="polite">
          <LoaderCircle className="spin" size={17} />
          <span>
            {progressLabels[progress?.stage ?? ""] ??
              progress?.message ??
              "Setting up your wallet"}
          </span>
        </div>
      ) : null}

      {registrationHash ? (
        <a
          className="registration-explorer-link"
          href={testnetTransactionUrl(registrationHash)}
          rel="noreferrer"
          target="_blank"
        >
          Private address confirmed
          <ExternalLink size={15} />
        </a>
      ) : null}

      {registrationStatus === "registered" ? (
        <div className="registration-next-step">
          <strong>What happens next?</strong>
          <span>
            Share your normal Stellar address with someone who wants to pay you
            privately. Obscura will find this private receiving address
            automatically.
          </span>
        </div>
      ) : null}

      {actionError ? (
        <p className="registration-error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="registration-actions">
        {!isConnected ? (
          <button
            disabled={isConnecting}
            onClick={connectWallet}
            type="button"
          >
            <WalletCards size={18} />
            {isConnecting ? "Opening Wallets" : "Connect Wallet"}
          </button>
        ) : canRegister ? (
          <button
            disabled={isRegistering}
            onClick={startRegistration}
            type="button"
          >
            {isRegistering ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <UserRoundCheck size={18} />
            )}
            {isRegistering ? "Setting Up" : "Set Up Private Receiving"}
          </button>
        ) : registrationStatus === "error" ? (
          <button
            className="registration-recovery-action"
            onClick={startRegistration}
            type="button"
          >
            <UserRoundCheck size={18} />
            Set Up Private Receiving
          </button>
        ) : registrationStatus === "syncing" ? (
          <button onClick={refreshRegistration} type="button">
            <RefreshCw size={18} />
            Check Again
          </button>
        ) : null}
        <small>
          Setup does not move your funds. Your wallet only pays a small
          Testnet network fee.
        </small>
      </div>

      {showPoolNote && isConnected ? (
        <div className="pool-access-note">
          <strong>Private receiving and pool access are separate.</strong>
          <span>
            Obscura checks the official SPP pool policy when you Shield. If
            self-enrollment is allowed, it happens automatically.
          </span>
        </div>
      ) : null}
    </section>
  );
}
