"use client";

import { motion } from "framer-motion";
import { ExternalLink, LoaderCircle, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useWalletConnection } from "../../wallet-context";

type TransactionRecord = {
  created_at: string;
  fee_charged: string;
  hash: string;
  memo?: string;
  successful: boolean;
};

type TransactionResponse = {
  _embedded: {
    records: TransactionRecord[];
  };
};

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export default function ActivityPage() {
  const { address, connectWallet, isConnected, isConnecting } =
    useWalletConnection();
  const [records, setRecords] = useState<TransactionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setRecords([]);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    void fetch(
      `https://horizon-testnet.stellar.org/accounts/${address}/transactions?order=desc&limit=20`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Live Testnet activity is unavailable.");
        return (await response.json()) as TransactionResponse;
      })
      .then((result) => setRecords(result._embedded.records))
      .catch((requestError) => {
        if (requestError instanceof Error && requestError.name !== "AbortError") {
          setError(requestError.message);
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [address]);

  return (
    <motion.section
      className="activity-page"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="wallet-section-heading">
        <p>// LIVE ACTIVITY</p>
        <h1>Testnet Transactions</h1>
      </div>

      {!isConnected ? (
        <div className="activity-empty">
          <WalletCards size={30} />
          <h2>Connect Your Wallet</h2>
          <p>Your real Stellar Testnet transactions will appear here.</p>
          <button disabled={isConnecting} onClick={connectWallet} type="button">
            {isConnecting ? "Opening Wallets" : "Connect Wallet"}
          </button>
        </div>
      ) : isLoading ? (
        <div className="activity-empty">
          <LoaderCircle className="spin" size={30} />
          <p>Loading Testnet transactions</p>
        </div>
      ) : error ? (
        <div className="activity-empty">
          <p>{error}</p>
        </div>
      ) : records.length ? (
        <div className="activity-table">
          {records.map((transaction) => (
            <a
              className="activity-table-row"
              href={`https://stellar.expert/explorer/testnet/tx/${transaction.hash}`}
              key={transaction.hash}
              rel="noreferrer"
              target="_blank"
            >
              <strong>{transaction.memo || "Stellar transaction"}</strong>
              <span>{shortHash(transaction.hash)}</span>
              <span>{transaction.fee_charged} stroops</span>
              <em>{transaction.successful ? "Confirmed" : "Failed"}</em>
              <small>
                {new Date(transaction.created_at).toLocaleDateString()}
                <ExternalLink size={13} />
              </small>
            </a>
          ))}
        </div>
      ) : (
        <div className="activity-empty">
          <p>No Testnet transactions found for this wallet.</p>
        </div>
      )}
    </motion.section>
  );
}
