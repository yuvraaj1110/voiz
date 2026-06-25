/** Pixel-art gold genie lamp (brand mark). Crisp at any size. */
export function GenieLamp({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Genie lamp"
      viewBox="0 0 128 128"
      className={className}
      shapeRendering="crispEdges"
    >
      {/* lamp body */}
      <rect x="53" y="43" width="14" height="8" fill="#ffb23a" />
      <rect x="47" y="51" width="28" height="8" fill="#ffb23a" />
      <rect x="37" y="59" width="54" height="8" fill="#ffd119" />
      <rect x="37" y="67" width="60" height="8" fill="#ffd119" />
      <rect x="40" y="75" width="54" height="8" fill="#ffd119" />
      <rect x="46" y="83" width="42" height="8" fill="#ffd119" />
      <rect x="52" y="91" width="30" height="8" fill="#ffd119" />
      {/* warm lower shadow */}
      <rect x="52" y="75" width="12" height="8" fill="#f6a33a" />
      <rect x="52" y="83" width="24" height="8" fill="#f6a33a" opacity="0.9" />
      <rect x="58" y="91" width="24" height="8" fill="#f6a33a" opacity="0.85" />
      {/* spout / lip */}
      <rect x="88" y="43" width="32" height="8" fill="#ffd119" />
      <rect x="80" y="51" width="44" height="8" fill="#ffd119" />
      <rect x="72" y="59" width="42" height="8" fill="#ffd119" />
      <rect x="66" y="67" width="30" height="8" fill="#ffd119" />
      <rect x="94" y="59" width="22" height="8" fill="#f6a33a" opacity="0.65" />
      {/* handle loop */}
      <rect x="18" y="35" width="18" height="8" fill="#ffd119" />
      <rect x="14" y="43" width="8" height="32" fill="#ffd119" />
      <rect x="30" y="43" width="8" height="48" fill="#ffd119" />
      <rect x="22" y="75" width="16" height="8" fill="#ffd119" />
      <rect x="26" y="83" width="8" height="16" fill="#ffd119" />
      <rect x="22" y="43" width="8" height="28" fill="#050505" />
      <rect x="22" y="67" width="8" height="8" fill="#050505" />
      {/* neck + base */}
      <rect x="58" y="99" width="20" height="8" fill="#ffb23a" />
      <rect x="55" y="107" width="26" height="8" fill="#ffb23a" />
      <rect x="49" y="115" width="40" height="6" fill="#ffd119" />
      <rect x="45" y="121" width="48" height="4" fill="#ffd119" />
    </svg>
  );
}
