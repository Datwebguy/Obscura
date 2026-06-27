# Stellar Private Payments Browser Artifacts

The files in `public/js` are compiled browser artifacts from Nethermind's
Stellar Private Payments reference implementation:

https://github.com/NethermindEth/stellar-private-payments

Upstream revision used for the copied browser artifacts:
`10352700afb56861bf3e67b1bf62a628300c2c45`

They are used to synchronize the deployed Testnet pool, derive private notes,
generate Groth16 proofs in a web worker, build Soroban transactions, and verify
proofs through the deployed SPP verifier contract.

The accompanying upstream license and notice files are included in this
directory. Obscura does not claim that SPP is audited or production
ready.
