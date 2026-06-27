const STROOPS_PER_XLM = BigInt(10_000_000);
const MAX_U64 = (BigInt(1) << BigInt(64)) - BigInt(1);
const FIELD_256_LIMIT = BigInt(1) << BigInt(256);
const BN254_FIELD_MODULUS = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617",
);

function parseXlmValue(value: string, allowZero: boolean) {
  const normalized = value.trim();
  const match = /^(\d+)(?:\.(\d{0,7}))?$/.exec(normalized);
  if (!match) {
    throw new Error(
      "Enter a valid XLM amount with no more than 7 decimal places.",
    );
  }

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(7, "0") || "0");
  const stroops = whole * STROOPS_PER_XLM + fraction;

  if (!allowZero && stroops <= BigInt(0)) {
    throw new Error("Enter an amount greater than zero.");
  }
  if (stroops > MAX_U64) {
    throw new Error("This amount is too large for a Stellar transaction.");
  }

  return stroops;
}

export function parseXlmToStroops(value: string) {
  return parseXlmValue(value, false);
}

export function parseXlmBalanceToStroops(value: string) {
  return parseXlmValue(value, true);
}

export function parseSerializedFieldToBigInt(value: string | bigint) {
  let parsed: bigint;

  if (typeof value === "bigint") {
    parsed = value;
  } else {
    const normalized = value.trim();
    if (
      !/^0x[0-9a-fA-F]{1,64}$/.test(normalized) &&
      !/^\d+$/.test(normalized)
    ) {
      throw new Error("The private access field has an invalid format.");
    }
    parsed = BigInt(normalized);
  }

  if (parsed < BigInt(0) || parsed >= FIELD_256_LIMIT) {
    throw new Error("The private access field is outside the 256-bit range.");
  }
  if (parsed >= BN254_FIELD_MODULUS) {
    throw new Error("The private access field is outside the privacy field range.");
  }

  return parsed;
}

export function formatStroops(stroops: bigint) {
  return stroops.toLocaleString("en-US");
}

export function formatStroopsAsXlm(value: string | bigint) {
  const stroops = typeof value === "bigint" ? value : BigInt(value);
  const whole = stroops / STROOPS_PER_XLM;
  const fraction = (stroops % STROOPS_PER_XLM)
    .toString()
    .padStart(7, "0")
    .replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}
