type IconProps = { className?: string };

const base = "stroke-current fill-none";
const common = {
  viewBox: "0 0 24 24",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CustomerIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function AgentIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <line x1="2" y1="10" x2="2" y2="14" />
      <line x1="6" y1="6" x2="6" y2="18" />
      <line x1="10" y1="3" x2="10" y2="21" />
      <line x1="14" y1="7" x2="14" y2="17" />
      <line x1="18" y1="5" x2="18" y2="19" />
      <line x1="22" y1="10" x2="22" y2="14" />
    </svg>
  );
}

export function RepIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <path d="M21 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2z" />
      <path d="M3 15a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2z" />
      <path d="M12 19a3 3 0 0 0 3-3" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
