"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  EyeOff,
  History,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Send,
  Shield,
  UnlockKeyhole,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { RegistrationPanel } from "../registration-panel";
import { ShieldModal } from "../shield-modal";
import { formatStroopsAsXlm } from "../stellar-amount";
import { useWalletConnection } from "../wallet-context";
import { testnetTransactionUrl } from "../../config";

const actionCards = [
  {
    action: "shield",
    title: "Shield",
    copy: "Move XLM from your public wallet into your private balance.",
    icon: Shield,
  },
  {
    href: "/wallet/send",
    title: "Send",
    copy: "Send from your private balance without exposing the payment.",
    icon: Send,
  },
  {
    href: "/wallet/unshield",
    title: "Unshield",
    copy: "Move private XLM back to any public Stellar wallet.",
    icon: EyeOff,
  },
  {
    href: "/wallet/activity",
    title: "Transactions",
    copy: "Review your recent Stellar Testnet transactions.",
    icon: History,
  },
];

function formatBalance(value: string | null) {
  if (!value) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 7,
  }).format(Number(value));
}

export default function WalletDashboardPage() {
  const {
    address,
    connectWallet,
    isConnected,
    isConnecting,
    lastVerifiedProof,
    nativeBalance,
    privateBalanceError,
    privateBalances,
    privateBalanceStatus,
    refreshPrivateBalances,
    unlockPrivateBalance,
  } = useWalletConnection();
  const [shieldOpen, setShieldOpen] = useState(false);

  useEffect(() => {
    setShieldOpen(false);
  }, [address]);

  const privateXlm = privateBalances.find(
    (balance) => balance.tokenLabel === "XLM",
  );
  const privateXlmAmount = formatStroopsAsXlm(privateXlm?.amount ?? "0");
  const privateNoteCount = privateXlm?.noteCount ?? 0;

  return (
    <div className="dashboard-page">
      <motion.section
        className="dashboard-welcome"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <p>// WELCOME</p>
          <h1>Private payments, made simple.</h1>
          <span>
            Move XLM into a private balance, send it without showing your
            payment details, and move it back whenever you choose.
          </span>
        </div>
        <div className="welcome-steps" aria-label="How Obscura works">
          <span><strong>1</strong> Connect your wallet</span>
          <span><strong>2</strong> Shield a small amount</span>
          <span><strong>3</strong> Send or unshield</span>
        </div>
      </motion.section>

      <RegistrationPanel showPoolNote />

      <motion.section
        className="private-balance-panel"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="private-banner">
          <LockKeyhole size={18} />
          <span>{isConnected ? "Private Balance" : "SPP Testnet Ready"}</span>
        </div>

        {lastVerifiedProof ? (
          <a
            className="verified-proof-badge"
            href={testnetTransactionUrl(lastVerifiedProof.hash)}
            rel="noreferrer"
            target="_blank"
          >
            <BadgeCheck size={17} />
            Last Private Action Verified
          </a>
        ) : (
          <div className="verified-proof-badge verified-proof-ready">
            <Shield size={17} />
            Official SPP Contracts
          </div>
        )}

        <div className="balance-copy">
          <p>// PRIVATE XLM BALANCE</p>
          <h1>
            {!isConnected
              ? "Connect Wallet"
              : privateBalanceStatus === "checking"
                ? "Syncing"
                : privateBalanceStatus === "locked"
                  ? "Unlock Balance"
                  : privateBalanceStatus === "error"
                    ? "Unavailable"
                    : `${privateXlmAmount} XLM`}
          </h1>
          <span>
            {!isConnected
              ? "Connect your Stellar wallet to find private payments sent to you."
              : privateBalanceStatus === "locked"
                ? "Sign one message to decrypt private notes in this browser. This costs nothing."
                : privateBalanceStatus === "checking"
                  ? "Looking for encrypted notes sent to this wallet."
                  : privateBalanceStatus === "error"
                    ? privateBalanceError ?? "Private balance sync is temporarily unavailable."
                    : privateNoteCount === 0
                      ? `No private notes found yet. Incoming payments can take 10 to 20 seconds to sync. Public wallet: ${formatBalance(nativeBalance)} XLM`
                      : `${privateNoteCount} private ${privateNoteCount === 1 ? "note" : "notes"}  |  Public wallet: ${formatBalance(nativeBalance)} XLM`}
          </span>
        </div>

        {isConnected && privateBalanceStatus === "locked" ? (
          <button
            className="balance-primary-action"
            onClick={() => void unlockPrivateBalance()}
            type="button"
          >
            Unlock Private Balance
            <UnlockKeyhole size={18} />
          </button>
        ) : isConnected && privateBalanceStatus === "error" ? (
          <button
            className="balance-primary-action"
            onClick={() => void refreshPrivateBalances()}
            type="button"
          >
            Try Sync Again
            <RefreshCw size={18} />
          </button>
        ) : isConnected && privateBalanceStatus === "checking" ? (
          <button className="balance-primary-action" disabled type="button">
            Syncing Private Notes
            <LoaderCircle className="spin" size={18} />
          </button>
        ) : isConnected ? (
          <div className="balance-panel-actions">
            <button
              className="balance-primary-action"
              onClick={() => setShieldOpen(true)}
              type="button"
            >
              Shield Assets
              <Shield size={18} />
            </button>
            <button
              className="balance-secondary-action"
              onClick={() => void refreshPrivateBalances()}
              type="button"
            >
              Refresh Private Notes
              <RefreshCw size={17} />
            </button>
          </div>
        ) : (
          <button
            className="balance-primary-action"
            onClick={connectWallet}
            disabled={isConnecting}
            type="button"
          >
            {isConnecting ? "Opening Wallets" : "Connect Wallet"}
            <WalletCards size={18} />
          </button>
        )}
      </motion.section>

      <section className="dashboard-grid" aria-label="Wallet actions">
        {actionCards.map(({ action, href, title, copy, icon: Icon }, index) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, delay: index * 0.05 }}
          >
            {href ? (
              <Link className="action-card" href={href}>
                <span>
                  <Icon size={24} />
                </span>
                <div>
                  <h2>{title}</h2>
                  <p>{copy}</p>
                </div>
              </Link>
            ) : (
              <button
                className="action-card"
                onClick={() => action === "shield" && setShieldOpen(true)}
                type="button"
              >
                <span>
                  <Icon size={24} />
                </span>
                <div>
                  <h2>{title}</h2>
                  <p>{copy}</p>
                </div>
              </button>
            )}
          </motion.div>
        ))}
      </section>

      <ShieldModal isOpen={shieldOpen} onClose={() => setShieldOpen(false)} />
    </div>
  );
}
