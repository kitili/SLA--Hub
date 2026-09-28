type Props = {
  firstName: string;
  lastName: string;
  className?: string;
};

export function StudentInitials({ firstName, lastName, className = "" }: Props) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-light-blue/40 to-electric-blue/15 text-sm font-extrabold tracking-wide text-electric-blue ring-1 ring-electric-blue/10 ${className}`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
