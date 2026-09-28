type Props = {
  balance: number;
  currency: string;
  className?: string;
};

export function FeeBadge({ balance, currency, className = "" }: Props) {
  const owes = balance > 0;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide ${
        owes
          ? "bg-danger-15 text-danger"
          : "bg-success-15 text-success"
      } ${className}`}
    >
      {owes ? "Owes" : "Clear"} · {currency} {balance.toLocaleString()}
    </span>
  );
}
