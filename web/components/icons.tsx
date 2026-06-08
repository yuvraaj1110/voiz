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

export function OfferIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <path d="M12 1v22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export function InterestIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 20l1-3.1A8.38 8.38 0 0 1 3 11.5a8.5 8.5 0 0 1 17 0z" />
    </svg>
  );
}

export function BriefcaseIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function AmountIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M5 7h9a3 3 0 0 1 0 6H7" />
      <path d="M7 13h7a3 3 0 0 1 0 6H5" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...common} className={`${base} ${className ?? ""}`}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
