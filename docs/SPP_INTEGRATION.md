# Stellar Private Payments Integration

Obscura uses Nethermind's official Stellar Private Payments reference
implementation for its privacy operations:

https://github.com/NethermindEth/stellar-private-payments

## Testnet Contracts

- XLM pool: `CBUEFW2J5QZ6Q2ARZWQPFWF4T7DRXCZWDTM34WNM375Y56FE4DSL42S2`
- Groth16 verifier: `CBKOZTEYI5RAGSUKWAQEC4V6MRYDC4KL2D3PRPKMLWHTMXMFSCBVUJXX`
- ASP membership: `CAMMKUKPKTR73DGBD5CLYXWDUYI6DP2EKUREW6O3L65EAZMF6GXJRMPK`
- ASP nonmembership: `CAOD7JDSOQ5IYX77KX4AFMZDGHIH3JQU2AZ2DKOBH6U5PGUSTGGWSZBA`
- Public key registry: `CBBWNJ75EQDPQWJJDZ2WHMJWPLDYDQUCTL2V6F23VG3JAL3PEYZSNL4S`

## Shield Flow

1. The connected wallet signs SPP's key derivation message.
2. SPP derives note, encryption, and ASP membership secrets locally.
3. The browser synchronizes pool and ASP state from Stellar Testnet.
4. A private note commitment and Groth16 proof are generated in a web worker.
5. The wallet signs Soroban authorization and the transaction envelope.
6. The pool calls the verifier contract and records the commitment only after
   the proof passes.
7. Obscura stores the confirmed transaction hash and displays
   `ZK Proof Verified on Soroban`.

## ASP Membership

The deployed SPP pool requires the derived privacy identity to exist in its ASP
membership tree. Obscura reads the live contract policy. When permissionless
insertion is enabled, the connected wallet signs a one-time enrollment
transaction and Obscura retries the Shield operation automatically after the
tree synchronizes.

If a future deployment changes to administrator-only insertion, Obscura never
reports a false success or moves funds. It explains the restriction and
provides the exact derived membership leaf as a copyable fallback.

## Private Receiving

Registration publishes only the wallet's public note and encryption keys. A
recipient does not receive a public XLM balance change. The encrypted private
note is discovered by the SPP client and appears after the recipient connects
the registered wallet and signs the local unlock message. Obscura polls for new
private notes while the private balance is unlocked.

## Current Scope

The official deployment currently has XLM and EURC pools. Obscura
enables XLM and does not represent USDC as privately supported. Private Send
uses SPP's registered recipient privacy keys. Unshield uses SPP's withdrawal
flow. All three paths generate a fresh proof and call the same pool verifier.

The public Soroban RPC has a limited event-retention window. For resilient
long-lived deployments, configure a compatible SPP bootnode/indexer through
`NEXT_PUBLIC_SPP_BOOTNODE_URL`.

SPP is experimental, unaudited Testnet software. It must be audited and
operationally hardened before handling production funds.
