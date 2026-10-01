export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className="text-center">
      <p className={`font-black tracking-tight text-primary ${size === 'lg' ? 'text-5xl' : 'text-2xl'}`}>Antojitos</p>
      {size === 'lg' && <p className="mt-1 text-lg text-ink/70">Menos vueltas, más sabor</p>}
    </div>
  );
}
