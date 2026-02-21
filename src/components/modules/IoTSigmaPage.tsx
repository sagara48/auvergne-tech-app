// ═══════════════════════════════════════════════════════════════
// MODULE IoT — Accès Sigma4Lifts
// Embarque la plateforme sigma4lifts.com dans l'application
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import {
  Radio, ExternalLink, Maximize2, Minimize2, RefreshCw,
} from 'lucide-react';

const SIGMA4_URL = 'https://www.sigma4lifts.com/sigma-front/#/';

export function IoTSigmaPage() {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className={fullscreen ? 'fixed inset-0 z-50 bg-[var(--bg-primary)] flex flex-col' : 'h-full flex flex-col gap-1 overflow-hidden'}>
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 px-1 py-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#059669] flex items-center justify-center">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-extrabold text-[var(--text-primary)]" style={{ letterSpacing: '-0.03em' }}>
              Sigma4Lifts
            </h1>
            <p className="text-[7px] text-[var(--text-muted)]">
              Télésurveillance IoT · sigma4lifts.com
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const iframe = document.getElementById('sigma4-frame') as HTMLIFrameElement;
              if (iframe) iframe.src = SIGMA4_URL;
            }}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
            title="Recharger"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
            title={fullscreen ? 'Réduire' : 'Plein écran'}
          >
            {fullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
          <a
            href={SIGMA4_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
            title="Ouvrir dans un nouvel onglet"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Iframe Sigma4Lifts */}
      <div className="flex-1 rounded-lg overflow-hidden border border-[var(--border-secondary)]">
        <iframe
          id="sigma4-frame"
          src={SIGMA4_URL}
          className="w-full h-full border-0"
          allow="geolocation; microphone; camera"
          title="Sigma4Lifts"
        />
      </div>
    </div>
  );
}

export default IoTSigmaPage;
