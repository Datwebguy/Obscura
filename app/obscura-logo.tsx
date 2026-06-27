type ObscuraLogoProps = {
  className?: string;
};

export function ObscuraLogo({ className = "" }: ObscuraLogoProps) {
  return (
    <img
      className={`obscura-logo ${className}`.trim()}
      src="/brand/obscura-favicon.png"
      alt=""
      aria-hidden="true"
    />
  );
}
