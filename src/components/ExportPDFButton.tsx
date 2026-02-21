// ═══════════════════════════════════════════════════
// EXPORT PDF BUTTON — Composant réutilisable
// ═══════════════════════════════════════════════════

import { useState } from 'react';
import { FileDown, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface ExportPDFButtonProps {
  /** Fonction d'export à appeler (import depuis pdfExports) */
  onExport: () => void | Promise<void>;
  /** Libellé du bouton */
  label?: string;
  /** Variante visuelle */
  variant?: 'default' | 'compact' | 'icon';
  /** ClassName additionnel */
  className?: string;
  /** Désactivé */
  disabled?: boolean;
}

export function ExportPDFButton({
  onExport,
  label = 'Exporter PDF',
  variant = 'default',
  className,
  disabled,
}: ExportPDFButtonProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  const handleClick = async () => {
    if (state !== 'idle' || disabled) return;
    setState('loading');
    try {
      await onExport();
      setState('done');
      toast.success('PDF exporté avec succès');
      setTimeout(() => setState('idle'), 2000);
    } catch (err) {
      setState('idle');
      toast.error('Erreur lors de l\'export PDF');
    }
  };

  const icon = state === 'loading'
    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
    : state === 'done'
    ? <Check className="w-3.5 h-3.5 text-[#059669]" />
    : <FileDown className="w-3.5 h-3.5" />;

  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        disabled={disabled || state === 'loading'}
        className={cn(
          'p-1.5 rounded-[8px] transition-all',
          'hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[#B91C1C]',
          disabled && 'opacity-40 cursor-not-allowed',
          className
        )}
        title={label}
      >
        {icon}
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        disabled={disabled || state === 'loading'}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold transition-all',
          'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-primary)]',
          'hover:bg-[var(--bg-hover)] hover:text-[#B91C1C] hover:border-[#B91C1C]/20',
          disabled && 'opacity-40 cursor-not-allowed',
          className
        )}
      >
        {icon}
        <span>{state === 'done' ? 'Exporté !' : label}</span>
      </button>
    );
  }

  // Default
  return (
    <button
      onClick={handleClick}
      disabled={disabled || state === 'loading'}
      className={cn(
        'flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[12px] font-semibold transition-all',
        'bg-[#B91C1C] text-white hover:bg-[#991B1B]',
        disabled && 'opacity-40 cursor-not-allowed',
        state === 'done' && 'bg-[#059669] hover:bg-[#059669]',
        className
      )}
    >
      {icon}
      <span>{state === 'loading' ? 'Export...' : state === 'done' ? 'Exporté !' : label}</span>
    </button>
  );
}

// ═══════════════════════════════════════════════════
// EXPORT MENU — Pour modules avec plusieurs options
// ═══════════════════════════════════════════════════

interface ExportOption {
  label: string;
  description?: string;
  onExport: () => void | Promise<void>;
}

interface ExportMenuProps {
  options: ExportOption[];
  className?: string;
}

export function ExportPDFMenu({ options, className }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px] font-semibold transition-all bg-[#B91C1C] text-white hover:bg-[#991B1B]"
      >
        <FileDown className="w-3.5 h-3.5" />
        Exporter PDF
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1.5 w-56 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl z-50 overflow-hidden"
            style={{ boxShadow: '0 8px 24px rgba(30,27,46,0.12)' }}
          >
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => {
                  opt.onExport();
                  setIsOpen(false);
                  toast.success(`Export "${opt.label}" lancé`);
                }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors border-b border-[var(--border-secondary)] last:border-0"
              >
                <div className="flex items-center gap-2">
                  <FileDown className="w-3.5 h-3.5 text-[#B91C1C]" />
                  <div>
                    <p className="text-[12px] font-semibold text-[var(--text-primary)]">{opt.label}</p>
                    {opt.description && (
                      <p className="text-[10px] text-[var(--text-muted)]">{opt.description}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
