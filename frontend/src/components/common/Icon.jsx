// Thin wrapper around Material Symbols Outlined
// Usage: <Icon name="home" size="md" filled />

const SIZES = {
  xs:  'text-base',
  sm:  'text-xl',
  md:  'text-2xl',
  lg:  'text-[28px]',
  xl:  'text-4xl',
  '2xl': 'text-5xl',
};

export default function Icon({ name, size = 'md', filled = false, className = '', style }) {
  return (
    <span
      className={`material-symbols-outlined ${SIZES[size] ?? SIZES.md} ${className}`}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
        ...style,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
