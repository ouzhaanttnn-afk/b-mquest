import React, { useState } from 'react';
import { playSound } from './sound';

const CARDS = [
  {
    icon: '🏠',
    title: 'Plan ve 3B aynı modeli gösterir',
    text: 'Duvarı plandan, 3B sahneden ya da listeden seç. Hepsi aynı modeli gösterir; birini değiştirince öteki de değişir.',
  },
  {
    icon: '🧾',
    title: 'Özellikleri (Properties) değiştir',
    text: 'Bir nesneyi seçince ölçüleri ve bilgileri ayarlayabilirsin. Revit’te sağdaki Properties paleti de böyle çalışır.',
  },
  {
    icon: '✅',
    title: 'Kontrol et, öğren, ilerle',
    text: 'Hazır olunca “Kontrol et”e bas. Yanlışsa nedenini söyleriz, doğruysa XP ve rozet kazanırsın. Takılırsan ipucu var.',
  },
];

/** Three short cards shown once, the first time the player reaches the mission screen. */
export const FirstRunTour: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [i, setI] = useState(0);
  const card = CARDS[i];
  const last = i === CARDS.length - 1;
  return (
    <div className="bq-modal-backdrop" role="dialog" aria-modal="true" aria-label="Hoş geldin" data-testid="first-run-tour">
      <div className="bq-modal-card">
        <div className="bq-tour-icon" aria-hidden="true">{card.icon}</div>
        <h2 data-testid="tour-title">{card.title}</h2>
        <p>{card.text}</p>
        <div className="bq-tour-dots" aria-hidden="true">
          {CARDS.map((_, n) => (
            <span key={n} className={`bq-tour-dot ${n === i ? 'on' : ''}`} />
          ))}
        </div>
        <div className="bq-modal-actions">
          <button type="button" className="bq-btn bq-btn-secondary" data-testid="tour-skip" onClick={onDone}>
            Geç
          </button>
          <button
            type="button"
            className="bq-btn bq-btn-primary"
            data-testid="tour-next"
            onClick={() => {
              playSound('click');
              if (last) onDone();
              else setI(i + 1);
            }}
          >
            {last ? 'Başlayalım' : 'İleri'}
          </button>
        </div>
      </div>
    </div>
  );
};
