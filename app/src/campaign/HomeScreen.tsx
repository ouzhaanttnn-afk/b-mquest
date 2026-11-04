import React, { useState } from 'react';
import { AboutSheet } from '../ui/AboutSheet';
import { BrandLogo } from '../ui/BrandLogo';
import { isSoundMuted, playSound, setSoundMuted } from '../ui/sound';
import { COMING_SOON, HOUSES } from './houses';
import { tx } from './i18n';
import type { HouseDef } from './model';
import { houseDone, houseStars, houseUnlocked, totalStars, type CampaignProgress } from './progress';
import { RibbonIcon } from './RibbonIcon';

/**
 * Home: the houses first, then one card for the missions. The next house is
 * the big card; settings live behind one menu button.
 */

interface Props {
  progress: CampaignProgress;
  missions: { done: number; total: number; next: string | null };
  settings: { theme: 'dark' | 'light'; reducedMotion: boolean; hapticsOff: boolean; reminderOn: boolean };
  initialHowTo?: boolean;
  onOpenHouse: (index: number) => void;
  onOpenMissions: () => void;
  onToggleTheme: () => void;
  onReducedMotion: (on: boolean) => void;
  onHaptics: (on: boolean) => void;
  onReminder: (on: boolean) => Promise<{ ok: boolean; reason?: string }>;
  onResetProgress: () => void;
  onBackToTitle: () => void;
}

const HouseIcon: React.FC<{ icon: HouseDef['icon'] }> = ({ icon }) => (
  <svg viewBox="0 0 64 56" width="64" height="56" aria-hidden="true" className="bq-home-house-icon">
    <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
      {icon === 'single' && (
        <>
          <path d="M6 28 32 8l26 20" />
          <rect x="12" y="26" width="40" height="24" />
          <rect x="18" y="35" width="8" height="15" fill="currentColor" />
          <rect x="34" y="33" width="12" height="8" strokeWidth="2.5" />
        </>
      )}
      {icon === 'double' && (
        <>
          <path d="M8 18 32 4l24 14" />
          <rect x="13" y="16" width="38" height="36" />
          <path d="M13 34h38" strokeWidth="2" />
          <rect x="18" y="38" width="8" height="14" fill="currentColor" />
          <rect x="19" y="21" width="9" height="7" strokeWidth="2.5" />
          <rect x="36" y="21" width="9" height="7" strokeWidth="2.5" />
          <rect x="36" y="39" width="9" height="7" strokeWidth="2.5" />
        </>
      )}
      {icon === 'sheet' && (
        <>
          <rect x="6" y="8" width="52" height="40" />
          <path d="M42 8v40M42 36h16" strokeWidth="2" />
          <path d="M12 30 22 22l10 8" strokeWidth="2" />
          <rect x="14" y="29" width="16" height="11" strokeWidth="2" />
          <path d="M12 44h26" strokeWidth="2" strokeDasharray="3 2" />
        </>
      )}
      {icon === 'twin' && (
        <>
          <path d="M2 26 17 12l15 14 15-14 15 14" />
          <rect x="6" y="24" width="52" height="26" />
          <path d="M32 24v26" strokeWidth="2" />
          <rect x="12" y="36" width="7" height="14" fill="currentColor" />
          <rect x="45" y="36" width="7" height="14" fill="currentColor" />
        </>
      )}
    </g>
  </svg>
);

const LevelDots: React.FC<{ house: HouseDef; progress: CampaignProgress }> = ({ house, progress }) => (
  <span className="bq-home-dots" aria-hidden="true">
    {house.levels.map((l) => (
      <span key={l.id} className={(progress.stars[l.id] ?? 0) > 0 ? 'on' : ''} />
    ))}
  </span>
);

const commandsOf = (house: HouseDef) => [...new Set(house.levels.flatMap((l) => l.steps.map((s) => s.command)))];

export const HomeScreen: React.FC<Props> = ({
  progress,
  missions,
  settings,
  initialHowTo = false,
  onOpenHouse,
  onOpenMissions,
  onToggleTheme,
  onReducedMotion,
  onHaptics,
  onReminder,
  onResetProgress,
  onBackToTitle,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [howTo, setHowTo] = useState(initialHowTo);
  const [about, setAbout] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [muted, setMuted] = useState(() => isSoundMuted());
  const [reminderNote, setReminderNote] = useState<string | null>(null);

  const nextIndex = (() => {
    const i = HOUSES.findIndex((h, k) => houseUnlocked(HOUSES, progress, k) && !houseDone(h, progress));
    return i === -1 ? HOUSES.length - 1 : i;
  })();
  const next = HOUSES[nextIndex];
  const started = houseStars(next, progress) > 0;
  const allDone = HOUSES.every((h) => houseDone(h, progress));

  return (
    <div className="bq-home" data-testid="home-screen">
      <header className="bq-home-head">
        <button type="button" className="bq-brand-btn" onClick={onBackToTitle} aria-label="Giriş ekranına dön" data-testid="brand-title-btn">
          <BrandLogo width={150} height={30} />
        </button>
        <span className="bq-home-stars" data-testid="home-total-stars">★ {totalStars(progress)}</span>
        <button
          type="button"
          className="bq-cmp-icon-btn"
          aria-label="Menü"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          data-testid="home-menu-btn"
        >
          ⋯
        </button>
      </header>

      <button
        type="button"
        className="bq-home-next"
        data-testid="home-next-house"
        onClick={() => {
          playSound('click');
          onOpenHouse(nextIndex);
        }}
      >
        <HouseIcon icon={next.icon} />
        <span className="bq-home-next-body">
          <small>{allDone ? 'Tüm evler bitti' : started ? 'Kaldığın yer' : nextIndex === 0 ? 'İlk evin' : 'Sıradaki ev'}</small>
          <strong>{tx(next.title, 'tr')}</strong>
          <span>{tx(next.brief, 'tr')}</span>
          <LevelDots house={next} progress={progress} />
        </span>
        <span className="bq-campaign-go">{allDone ? 'Tekrar' : started ? 'Devam' : 'Başla'} ▶</span>
      </button>

      <h2 className="bq-home-section">Evler</h2>
      <ol className="bq-home-houses">
        {HOUSES.map((h, i) => {
          const open = houseUnlocked(HOUSES, progress, i);
          return (
            <li key={h.id}>
              <button
                type="button"
                className={`bq-home-house ${houseDone(h, progress) ? 'done' : ''}`}
                disabled={!open}
                onClick={() => {
                  playSound('click');
                  onOpenHouse(i);
                }}
                data-testid={`home-house-${h.id}`}
              >
                <HouseIcon icon={h.icon} />
                <span className="bq-home-house-body">
                  <strong>
                    {i + 1}. {tx(h.title, 'tr')}
                  </strong>
                  <span className="bq-home-cmds">
                    {commandsOf(h).map((c) => (
                      <RibbonIcon key={c} id={c} />
                    ))}
                  </span>
                </span>
                <span className="bq-home-house-side">
                  {open ? (
                    <span className="bq-home-house-stars">★ {houseStars(h, progress)}/{h.levels.length * 3}</span>
                  ) : (
                    <span className="bq-home-lock">🔒 Önceki evi bitir</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <h2 className="bq-home-section">Görevler</h2>
      <button
        type="button"
        className="bq-home-house bq-home-missions"
        onClick={() => {
          playSound('click');
          onOpenMissions();
        }}
        data-testid="home-missions-btn"
      >
        <span className="bq-home-missions-count" aria-hidden="true">
          {missions.done}
          <small>/{missions.total}</small>
        </span>
        <span className="bq-home-house-body">
          <strong>Kısa Revit görevleri</strong>
          <span>{missions.next ? `Sıradaki: ${missions.next}` : 'Hepsini bitirdin!'}</span>
          <span className="bq-home-bar" aria-hidden="true">
            <span style={{ width: `${missions.total ? (missions.done / missions.total) * 100 : 0}%` }} />
          </span>
        </span>
        <span className="bq-campaign-go">{missions.done > 0 ? 'Devam' : 'Aç'} ▶</span>
      </button>

      <h2 className="bq-home-section">Yakında</h2>
      <ol className="bq-home-houses">
        {COMING_SOON.map((h, i) => (
          <li key={h.id}>
            <div className="bq-home-house soon" aria-disabled="true">
              <span className="bq-home-soon-num">{HOUSES.length + i + 1}</span>
              <span className="bq-home-house-body">
                <strong>{h.title}</strong>
                <span>{h.brief}</span>
              </span>
              <span className="bq-home-house-side">Yakında</span>
            </div>
          </li>
        ))}
      </ol>

      {menuOpen && (
        <div className="bq-cmp-modal-back" onClick={() => setMenuOpen(false)}>
          <div className="bq-cmp-modal bq-home-menu" role="dialog" aria-label="Ayarlar" onClick={(e) => e.stopPropagation()} data-testid="home-menu">
            <h2>Ayarlar</h2>
            <label className="bq-home-toggle">
              <span>Ses efektleri</span>
              <input
                type="checkbox"
                checked={!muted}
                onChange={(e) => {
                  setSoundMuted(!e.target.checked);
                  setMuted(!e.target.checked);
                }}
                data-testid="toggle-sound"
              />
            </label>
            <label className="bq-home-toggle">
              <span>Titreşim</span>
              <input type="checkbox" checked={!settings.hapticsOff} onChange={(e) => onHaptics(e.target.checked)} data-testid="toggle-haptics" />
            </label>
            <label className="bq-home-toggle">
              <span>Açık tema</span>
              <input
                type="checkbox"
                checked={settings.theme === 'light'}
                onChange={onToggleTheme}
                data-testid="theme-toggle-btn"
              />
            </label>
            <label className="bq-home-toggle">
              <span>Hareketi azalt</span>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) => onReducedMotion(e.target.checked)}
                data-testid="toggle-reduced-motion"
              />
            </label>
            <label className="bq-home-toggle">
              <span>Günlük hatırlatma (19:00)</span>
              <input
                type="checkbox"
                checked={settings.reminderOn}
                onChange={async (e) => {
                  const res = await onReminder(e.target.checked);
                  setReminderNote(
                    res.ok ? null : res.reason === 'web' ? 'Hatırlatma yalnız iPhone/iPad uygulamasında çalışır.' : 'Bildirim izni verilmedi. Ayarlar → Bildirimler’den açabilirsin.'
                  );
                }}
                data-testid="toggle-reminder"
              />
            </label>
            {reminderNote && <p className="bq-home-note" role="status">{reminderNote}</p>}
            <div className="bq-home-menu-actions">
              <button type="button" className="bq-cmp-icon-btn" onClick={() => { setMenuOpen(false); setHowTo(true); }} data-testid="help-btn">
                Nasıl oynanır?
              </button>
              <button type="button" className="bq-cmp-icon-btn" onClick={() => { setMenuOpen(false); setAbout(true); }} data-testid="about-btn">
                Hakkında ve gizlilik
              </button>
              {confirmReset ? (
                <button
                  type="button"
                  className="bq-cmp-icon-btn bq-danger"
                  onClick={() => {
                    onResetProgress();
                    setConfirmReset(false);
                    setMenuOpen(false);
                  }}
                  data-testid="reset-confirm-btn"
                >
                  Evet, tüm yıldızları sil
                </button>
              ) : (
                <button type="button" className="bq-cmp-icon-btn" onClick={() => setConfirmReset(true)} data-testid="reset-progress-btn">
                  İlerlemeyi sıfırla
                </button>
              )}
            </div>
            <button type="button" className="bq-cmp-primary" onClick={() => setMenuOpen(false)}>
              Kapat
            </button>
          </div>
        </div>
      )}

      {howTo && (
        <div className="bq-cmp-modal-back" onClick={() => setHowTo(false)}>
          <div className="bq-cmp-modal" role="dialog" aria-label="Nasıl oynanır" onClick={(e) => e.stopPropagation()} data-testid="howto-sheet">
            <h2>Nasıl oynanır?</h2>
            <ol className="bq-home-howto">
              <li>
                <RibbonIcon id="wall" />
                <span><strong>Komutu seç.</strong> Üstteki şerit Revit’teki gibidir: Wall, Door, Floor…</span>
              </li>
              <li>
                <span className="bq-home-howto-ghost" aria-hidden="true" />
                <span><strong>Kesik çizgiye dokun.</strong> Hedef yanıp söner; dokunuşun en yakın noktaya yapışır.</span>
              </li>
              <li>
                <span className="bq-home-howto-star" aria-hidden="true">★</span>
                <span><strong>Yıldız topla.</strong> ★ bitir · ★★ yanlış komut yok · ★★★ hamle sınırında.</span>
              </li>
            </ol>
            <p className="bq-cmp-bridge">Her bölüm birkaç dakikadır. Sonunda o komutun Revit’teki yerini ve kısayolunu görürsün.</p>
            <button type="button" className="bq-cmp-primary" onClick={() => setHowTo(false)} data-testid="howto-close">
              Anladım
            </button>
          </div>
        </div>
      )}

      {about && <AboutSheet onClose={() => setAbout(false)} />}
    </div>
  );
};
