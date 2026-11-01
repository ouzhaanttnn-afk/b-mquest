import React from 'react';
import { playSound } from './sound';

export interface TitleScreenProps {
  hasProgress: boolean;
  stars: number;
  onPlay: () => void;
  onHowToPlay: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ hasProgress, stars, onPlay, onHowToPlay }) => (
  <main className="bq-title" data-testid="title-screen">
    <div className="bq-title-grid" aria-hidden="true" />
    <svg className="bq-title-plan" viewBox="0 0 240 160" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
        <path className="bq-draw d1" d="M20 20 H220" />
        <path className="bq-draw d2" d="M220 20 V140" />
        <path className="bq-draw d3" d="M220 140 H20" />
        <path className="bq-draw d4" d="M20 140 V20" />
        <path className="bq-draw d5" d="M140 20 V140" strokeWidth="2" />
      </g>
    </svg>

    <div className="bq-title-body">
      <img
        src="./assets/brand/logo-horizontal.svg"
        alt="BIM QUEST"
        className="bq-title-logo"
        width={280}
        height={56}
      />
      <p className="bq-title-tagline">Revit'i ev yaparak öğren.</p>
      <p className="bq-title-sub">
        Kısa bölümler, gerçek Revit komutları. İlk evin bir bahçe evi.
      </p>

      <div className="bq-title-actions">
        <button
          type="button"
          className="bq-btn bq-btn-primary bq-title-play"
          data-testid="title-play-btn"
          onClick={() => {
            playSound('success');
            onPlay();
          }}
        >
          ▶ {hasProgress ? 'Devam Et' : 'Oyuna Başla'}
        </button>
        <button
          type="button"
          className="bq-btn bq-btn-secondary"
          data-testid="title-howto-btn"
          onClick={() => {
            playSound('click');
            onHowToPlay();
          }}
        >
          Nasıl Oynanır?
        </button>
      </div>

      {hasProgress && (
        <p className="bq-title-player" data-testid="title-player">
          ★ {stars} yıldız
        </p>
      )}
    </div>
  </main>
);
