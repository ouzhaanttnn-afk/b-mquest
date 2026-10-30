import React, { useRef, useState } from 'react';
import { buildCertificate, cleanName } from '../domain/certificate';
import { svgToPngDownload } from '../plan/SheetSvg';

interface Props {
  completed: Record<string, { bestScore: number }>;
  name: string;
  onNameChange: (name: string) => void;
  onClose: () => void;
}

const W = 1200;
const H = 850;

/** Graduation certificate: shows the player's results and exports a PNG. */
export const CertificateSheet: React.FC<Props> = ({ completed, name, onNameChange, onClose }) => {
  const [draft, setDraft] = useState(name);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [today] = useState(() => new Date());
  const data = buildCertificate(completed, draft, today);
  return (
    <div
      className="bq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Sertifika"
      data-testid="certificate-sheet"
      onClick={onClose}
    >
      <div className="bq-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="bq-form-title-row">
          <h2>Mezuniyet Sertifikası</h2>
          <button type="button" className="bq-chip-btn" onClick={onClose}>✕ Kapat</button>
        </div>
        <label className="bq-field">
          <span>Adın (sertifikaya yazılır)</span>
          <input
            data-testid="certificate-name"
            value={draft}
            maxLength={40}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => onNameChange(cleanName(draft))}
          />
        </label>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="bq-cert-svg"
          role="img"
          aria-label={`${data.name} için BIM QUEST mezuniyet sertifikası`}
          data-testid="certificate-svg"
        >
          <rect width={W} height={H} fill="#0B1120" />
          <rect x="30" y="30" width={W - 60} height={H - 60} fill="none" stroke="#38BDF8" strokeWidth="6" />
          <rect x="50" y="50" width={W - 100} height={H - 100} fill="none" stroke="#F97316" strokeWidth="2" />
          <text x={W / 2} y="170" textAnchor="middle" fontSize="40" fontWeight="800" fill="#F97316" fontFamily="sans-serif">BIM QUEST</text>
          <text x={W / 2} y="250" textAnchor="middle" fontSize="54" fontWeight="800" fill="#F8FAFC" fontFamily="sans-serif">Mezuniyet Sertifikası</text>
          <text x={W / 2} y="340" textAnchor="middle" fontSize="28" fill="#94A3B8" fontFamily="sans-serif">Bu belge</text>
          <text x={W / 2} y="430" textAnchor="middle" fontSize="64" fontWeight="800" fill="#38BDF8" fontFamily="sans-serif" data-testid="certificate-name-text">{data.name}</text>
          <text x={W / 2} y="500" textAnchor="middle" fontSize="28" fill="#CBD5E1" fontFamily="sans-serif">kişisinin Revit’te modelleme, bilgi, görünüm ve pafta temellerini</text>
          <text x={W / 2} y="540" textAnchor="middle" fontSize="28" fill="#CBD5E1" fontFamily="sans-serif">oynayarak tamamladığını gösterir.</text>
          <text x="300" y="670" textAnchor="middle" fontSize="44" fontWeight="800" fill="#F8FAFC" fontFamily="sans-serif">{data.missions}</text>
          <text x="300" y="705" textAnchor="middle" fontSize="22" fill="#94A3B8" fontFamily="sans-serif">görev</text>
          <text x="600" y="670" textAnchor="middle" fontSize="44" fontWeight="800" fill="#F8FAFC" fontFamily="sans-serif">{data.totalXp} XP</text>
          <text x="600" y="705" textAnchor="middle" fontSize="22" fill="#94A3B8" fontFamily="sans-serif">Sv.{data.level} · {data.rankTitle}</text>
          <text x="900" y="670" textAnchor="middle" fontSize="44" fontWeight="800" fill="#F8FAFC" fontFamily="sans-serif">{data.goldCount}</text>
          <text x="900" y="705" textAnchor="middle" fontSize="22" fill="#94A3B8" fontFamily="sans-serif">altın rozet</text>
          <text x={W / 2} y="780" textAnchor="middle" fontSize="22" fill="#64748B" fontFamily="sans-serif">{data.dateLabel}</text>
        </svg>
        <div className="bq-modal-actions">
          <button
            type="button"
            className="bq-btn bq-btn-primary"
            data-testid="certificate-download"
            onClick={() => {
              onNameChange(cleanName(draft));
              if (svgRef.current) void svgToPngDownload(svgRef.current, W, H, 'bimquest-sertifika.png');
            }}
          >
            PNG olarak indir
          </button>
        </div>
      </div>
    </div>
  );
};
