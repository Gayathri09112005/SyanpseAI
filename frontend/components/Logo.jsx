/** The design's mark: a rotated accent square inside a soft accent tile. */
export function Logo({ size = 26 }) {
  const inner = Math.round(size * 0.35);
  return (
    <span
      style={{
        width: size, height: size, borderRadius: size * 0.35, border: '1px solid var(--accent-line)',
        background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
      }}
      aria-hidden
    >
      <span style={{ width: inner, height: inner, background: 'var(--accent)', borderRadius: 2, transform: 'rotate(45deg)' }} />
    </span>
  );
}
