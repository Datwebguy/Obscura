"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronDown,
  Copy,
  History,
  Home,
  LogOut,
  Menu,
  RefreshCw,
  Send,
  Shield,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import { ObscuraLogo } from "../obscura-logo";
import { useState } from "react";
import { useWalletConnection, WalletProvider } from "./wallet-context";
import { ThemeControls } from "../theme-controls";

const navItems = [
  { href: "/wallet", label: "Home", icon: Home },
  { href: "/wallet/shield", label: "Shield", icon: Shield },
  { href: "/wallet/send", label: "Private Send", icon: Send },
  { href: "/wallet/unshield", label: "Unshield", icon: Undo2 },
  { href: "/wallet/activity", label: "Activity", icon: History },
];

function shortenAddress(address: string | null) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-5)}`;
}

function WalletSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { isConnected } = useWalletConnection();

  return (
    <>
      <button className={`wallet-scrim ${isOpen ? "wallet-scrim-open" : ""}`} onClick={onClose} aria-label="Close menu" />
      <aside className={`wallet-sidebar ${isOpen ? "wallet-sidebar-open" : ""}`}>
        <div className="wallet-sidebar-brand">
          <ObscuraLogo className="obscura-logo-wallet" />
          <div>
            <strong>Obscura</strong>
            <small>Testnet</small>
          </div>
          <button className="sidebar-close" onClick={onClose} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <nav className="wallet-sidebar-nav" aria-label="Wallet navigation">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                className={active ? "wallet-nav-item wallet-nav-item-active" : "wallet-nav-item"}
                href={href}
                key={href}
                onClick={onClose}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="wallet-sidebar-footer">
          <p>// TESTNET STATUS</p>
          <strong>{isConnected ? "Wallet connected" : "Wallet not connected"}</strong>
        </div>
      </aside>
    </>
  );
}

function WalletTopbar({ onMenu }: { onMenu: () => void }) {
  const {
    address,
    error,
    isBalanceLoading,
    isConnected,
    isConnecting,
    nativeBalance,
    network,
    connectWallet,
    disconnectWallet,
    refreshBalances,
  } = useWalletConnection();
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="wallet-topbar-shell">
      <button className="wallet-icon-button wallet-mobile-menu" onClick={onMenu} aria-label="Open wallet navigation">
        <Menu size={20} />
      </button>

      <div className="wallet-topbar-title">
        <Wallet size={19} />
        <span>Obscura Wallet</span>
      </div>

      <div className="wallet-topbar-actions">
        <div className="private-toggle private-toggle-on" aria-label="Official SPP Testnet">
          <span className="private-toggle-dot" />
          <span className="private-toggle-label">SPP Testnet</span>
        </div>

        <ThemeControls surface="wallet" />

        {isConnected ? (
          <div className="connected-wallet">
            <button className="wallet-address-button" type="button">
              <span className="connection-dot" />
              <span className="wallet-address-copy">
                <strong>{shortenAddress(address)}</strong>
                <small>
                  {network}
                  {nativeBalance ? `  ${Number(nativeBalance).toLocaleString("en-US", { maximumFractionDigits: 2 })} XLM` : ""}
                </small>
              </span>
              <ChevronDown size={15} />
            </button>
            <div className="wallet-menu">
              <button onClick={copyAddress} type="button">
                <Copy size={15} />
                {copied ? "Address copied" : "Copy address"}
              </button>
              <button disabled={isBalanceLoading} onClick={refreshBalances} type="button">
                <RefreshCw className={isBalanceLoading ? "spin" : ""} size={15} />
                Refresh balance
              </button>
              <button type="button" onClick={disconnectWallet}>
                <LogOut size={15} />
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <button className="connect-wallet-button" onClick={connectWallet} disabled={isConnecting} type="button">
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>

      {error ? <p className="wallet-connect-error">{error}</p> : null}
    </header>
  );
}

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <WalletProvider>
      <main className="wallet-app">
        <WalletSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <section className="wallet-main">
          <WalletTopbar onMenu={() => setSidebarOpen(true)} />
          <motion.div
            className="wallet-content"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </section>
      </main>
    </WalletProvider>
  );
}
