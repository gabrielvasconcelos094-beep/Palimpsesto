/** 0–100 em passos de 5, com "não informado" (null) até o primeiro toque. */
export function PercentSlider({ value, onChange, label, low = 'nada', high = 'totalmente' }: { value: number | null; onChange: (v: number | null) => void; label: string; low?: string; high?: string }) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row between">
        <span className="small">{label}</span>
        <span className="small" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {value == null ? '—' : `${value}%`}
          {value != null && (
            <button className="btn ghost sm" style={{ padding: '0 0 0 8px', minHeight: 0 }} onClick={() => onChange(null)} aria-label={`Limpar: ${label}`}>
              limpar
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        aria-label={label}
        value={value ?? 50}
        className={value == null ? 'range unset' : 'range'}
        onChange={(e) => onChange(Number(e.target.value))}
        onClick={(e) => value == null && onChange(Number((e.target as HTMLInputElement).value))}
      />
      <div className="row between xs faint">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
