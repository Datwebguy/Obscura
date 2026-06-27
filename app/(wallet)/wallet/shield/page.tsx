"use client";

import { motion } from "framer-motion";
import { ArrowDownToLine, Shield } from "lucide-react";
import { useState } from "react";
import { ShieldModal } from "../../shield-modal";
import { useWalletConnection } from "../../wallet-context";

export default function ShieldPage() {
  const { isConnected } = useWalletConnection();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.section
      className="wallet-form-page"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="wallet-section-heading">
        <p>// SHIELD</p>
        <h1>Make XLM Private</h1>
        <span className="wallet-heading-copy">
          Move a small amount of XLM into your private balance.
        </span>
      </div>

      <div className="wallet-form-card shield-route-card">
        <span className="shield-route-icon">
          <Shield size={30} />
        </span>
        <div>
          <h2>{isConnected ? "Wallet Ready" : "Connect to Begin"}</h2>
          <p>
            Choose an amount, approve it in your wallet, and Obscura will
            add it to your private balance.
          </p>
        </div>
        <button onClick={() => setIsOpen(true)} type="button">
          <ArrowDownToLine size={18} />
          Open Shield Flow
        </button>
      </div>

      <div className="wallet-info-strip">
        <Shield size={18} />
        Experimental Testnet software. Start with a small amount while trying
        the privacy flow.
      </div>

      <ShieldModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </motion.section>
  );
}
