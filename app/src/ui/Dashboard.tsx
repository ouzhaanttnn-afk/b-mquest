import React, { useRef, useState } from 'react';
import { SIX_CHAPTER_CURRICULUM } from '../content/curriculum';
import { isMissionUnlocked } from '../domain/persistence';
import { ACHIEVEMENTS, earnedAchievementIds, summarizeStats, type GameMeta } from '../domain/gameMeta';
import type {
  MissionTask,
  SaveEnvelopeV1,
} from '../domain/types';
import { playSound } from './sound';
import { HelpSheet } from './HelpSheet';
import { CertificateSheet } from './CertificateSheet';
import { AboutSheet } from './AboutSheet';
import { workshopUnlocked } from '../content/workshop';
import { certificateUnlocked } from '../domain/certificate';

export interface DashboardProps {
  missions: MissionTask[];
  save: SaveEnvelopeV1;
  theme: 'light' | 'dark';
  streak: number;
  meta: GameMeta;
  onSetPlayerName: (name: string) => void;
  onStartWorkshop: () => void;
  /** Back to the home screen (the houses). */
  onBackToHome?: () => void;
  onSetHaptics: (on: boolean) => void;
  onSetReminder: (on: boolean) => Promise<{ ok: boolean; reason?: string }>;
  initialInfoOpen?: boolean;
  onBackToTitle?: () => void;
  storageWarning: string | null;
  recoveryIssue: {
    reason: string;
    message: string;
    rawText: string;
  } | null;
  onToggleTheme: () => void;
  onStartMission: (missionId: string, resumeDraft: boolean) => void;
  onExportSave: () => void;
  onImportSaveText: (rawText: string) => { ok: boolean; message: string };
  onUpdateSettings: (partial: Partial<SaveEnvelopeV1['settings']>) => void;
  onClearAllData: () => void;
  onDismissRecoveryIssue: () => void;
}

function scoreToStars(score: number): number {
  if (score >= 90) return 3;
  if (score >= 75) return 2;
  return 1;
}

export const Dashboard: React.FC<DashboardProps> = ({
  missions,
  save,
  theme,
  meta,
  onSetPlayerName,
  onStartWorkshop,
  onBackToHome,
  onSetHaptics,
  onSetReminder,
  initialInfoOpen = false,
  onBackToTitle,
  storageWarning,
  recoveryIssue,
  onToggleTheme,
  onStartMission,
  onExportSave,
  onImportSaveText,
  onUpdateSettings,
  onClearAllData,
  onDismissRecoveryIssue,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const settingsRef = useRef<HTMLElement | null>(null);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [selectedStageChapterId, setSelectedStageChapterId] = useState<string>('ch01');
  const [infoModalOpen, setInfoModalOpen] = useState(initialInfoOpen);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const pick = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };
  const [reminderNote, setReminderNote] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      setImportFeedback({
        type: 'error',
        text: 'Seçilen dosya 1 MiB sınırını aşıyor ve reddedildi.',
      });
      e.target.value = '';
      return;
    }
    const text = await file.text();
    const res = onImportSaveText(text);
    setImportFeedback({
      type: res.ok ? 'success' : 'error',
      text: res.message,
    });
    e.target.value = '';
  };

  const downloadRawCorruptData = () => {
    if (!recoveryIssue) return;
    const blob = new Blob([recoveryIssue.rawText], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bimquest-kurtarma-yedegi.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const completedCount = Object.keys(save.completed).length;
  const statsSummary = summarizeStats(meta);
  const earnedIds = earnedAchievementIds(save.completed);
  const nextMission =
    missions.find(
      (m) =>
        !(m.id in save.completed) && isMissionUnlocked(m, save.completed).unlocked
    ) ?? null;
  const nextChapter = nextMission
    ? SIX_CHAPTER_CURRICULUM.find((ch) =>
        ch.missions.some((cm) => cm.id === nextMission.id)
      )
    : undefined;
  const nextHasDraft = nextMission ? Boolean(save.drafts[nextMission.id]) : false;
  const allDone = missions.length > 0 && !nextMission;

  const activeChapter =
    SIX_CHAPTER_CURRICULUM.find((ch) => ch.id === selectedStageChapterId) ??
    SIX_CHAPTER_CURRICULUM[0];
  const activeChapterMissionIds = new Set(
    activeChapter.missions.map((m) => m.id)
  );
  const visibleMissions = missions.filter((m) =>
    activeChapterMissionIds.has(m.id)
  );

  return (
    <div className="bq-dashboard" data-testid="dashboard-screen">
      {/* Compact Game Topbar */}
      <header className="bq-dash-header">
        <div className="bq-brand-row bq-missions-head">
          <button
            type="button"
            className="bq-cmp-icon-btn"
            data-testid="missions-back-btn"
            onClick={onBackToHome ?? onBackToTitle}
          >
            ← Evler
          </button>
          <h1 className="bq-missions-title">Görevler</h1>
        </div>

        {/* Compact Player HUD Stats & Quick Controls */}
        <div className="bq-dash-actions" data-testid="progress-summary">
          <div className="bq-hud-pill" data-testid="mission-count-pill">
            ✓ {completedCount} / {missions.length} görev
          </div>

          <button
            type="button"
            className="bq-icon-pill-btn"
            data-testid="achievements-btn"
            onClick={() => {
              playSound('click');
              setAchievementsOpen(true);
            }}
            aria-label="Başarımlar"
            title="Başarımlar"
          >
            <span>🏅 {earnedIds.length}/{ACHIEVEMENTS.length}</span>
          </button>

          {certificateUnlocked(save.completed) && (
            <button
              type="button"
              className="bq-icon-pill-btn"
              data-testid="certificate-btn"
              aria-label="Mezuniyet sertifikası"
              title="Mezuniyet sertifikası"
              onClick={() => {
                playSound('click');
                setCertificateOpen(true);
              }}
            >
              <span>🎓</span>
            </button>
          )}

          <button
            type="button"
            className="bq-icon-pill-btn bq-more-btn"
            data-testid="dash-menu-btn"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-label="Diğer seçenekler"
            title="Diğer seçenekler"
            onClick={() => {
              playSound('click');
              setMenuOpen(true);
            }}
          >
            <span aria-hidden="true">⋯</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            data-testid="import-file-input"
            onChange={handleFileChange}
          />
        </div>

      </header>

      {/* Storage or Recovery Banners */}
      {storageWarning && (
        <div
          className="bq-banner bq-banner-warning"
          role="alert"
          data-testid="storage-warning-banner"
        >
          <div>
            <strong>Depolama Uyarısı:</strong> {storageWarning}
          </div>
          <button
            type="button"
            className="bq-btn bq-btn-secondary bq-btn-compact"
            onClick={onExportSave}
          >
            Şimdi Dışa Aktar
          </button>
        </div>
      )}

      {recoveryIssue && (
        <div
          className="bq-banner bq-banner-error"
          role="alert"
          data-testid="recovery-issue-banner"
        >
          <div>
            <strong>Kayıt Kurtarma Gerekli ({recoveryIssue.reason}):</strong>{' '}
            {recoveryIssue.message}
          </div>
          <div className="bq-banner-actions">
            <button
              type="button"
              className="bq-btn bq-btn-secondary bq-btn-compact"
              data-testid="export-corrupt-btn"
              onClick={downloadRawCorruptData}
            >
              Ham Veriyi İndir
            </button>
            <button
              type="button"
              className="bq-btn bq-btn-primary bq-btn-compact"
              data-testid="reset-corrupt-btn"
              onClick={onDismissRecoveryIssue}
            >
              Temiz Oturum Başlat
            </button>
          </div>
        </div>
      )}

      {importFeedback && (
        <div
          className={`bq-banner ${
            importFeedback.type === 'error'
              ? 'bq-banner-error'
              : 'bq-banner-success'
          }`}
          role="status"
          data-testid="import-feedback-banner"
        >
          <span>{importFeedback.text}</span>
          <button
            type="button"
            className="bq-chip-btn"
            onClick={() => setImportFeedback(null)}
          >
            Kapat
          </button>
        </div>
      )}

      {/* Hero: what to do next */}
      <section className="bq-hero" data-testid="hero-card" aria-label="Sıradaki görev">
        <div className="bq-hero-body">
          {allDone ? (
            <h2>Tüm görevler bitti!</h2>
          ) : nextMission ? (
            <>
              <span className="bq-hero-kicker">{completedCount === 0 ? 'İlk görevin' : 'Sıradaki görev'}</span>
              <h2>{nextMission.title}</h2>
            </>
          ) : null}
        </div>
        {nextMission && (
          <button
            type="button"
            className="bq-btn bq-btn-primary bq-hero-cta"
            data-testid="hero-continue-btn"
            onClick={() => {
              playSound('click');
              if (nextChapter) setSelectedStageChapterId(nextChapter.id);
              onStartMission(nextMission.id, true);
            }}
          >
            ▶ {nextHasDraft ? 'Devam Et' : 'Başla'}
          </button>
        )}
      </section>

      {workshopUnlocked(save.completed) && (
        <button
          type="button"
          className="bq-workshop-card"
          data-testid="workshop-btn"
          onClick={() => {
            playSound('click');
            onStartWorkshop();
          }}
        >
          <span className="bq-workshop-icon" aria-hidden="true">🛠️</span>
          <span>
            <strong>Serbest Atölye</strong>
            <small>Görevsiz, tüm araçlar açık. Kendi evini kur; modelin cihazında kalır.</small>
          </span>
        </button>
      )}

      {/* Compact Stage Header + 7-Chapter Tabs + Connected Blueprint Route Track */}
      <div className="bq-stage-banner">
        <div className="bq-stage-title-block">
          <h1>{activeChapter.title}</h1>
          <div className="bq-chapter-pill-bar" role="tablist" aria-label="Bölüm Seçimi">
            {SIX_CHAPTER_CURRICULUM.map((ch) => {
              const doneInCh = ch.missions.filter((m) => m.id in save.completed).length;
              return (
                <button
                  key={ch.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedStageChapterId === ch.id}
                  className={`bq-chip-btn ${
                    selectedStageChapterId === ch.id ? 'active' : ''
                  }`}
                  data-testid={`stage-tab-${ch.id}`}
                  onClick={() => {
                    playSound('click');
                    setSelectedStageChapterId(ch.id);
                  }}
                >
                  Bölüm {ch.chapterNumber} ({doneInCh}/{ch.missions.length})
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Playable Mission Cards Grid for Selected Chapter */}
      <section className="bq-missions-grid" aria-label="Oynanabilir Görev Kartları">
        {visibleMissions.map((mission) => {
          const { unlocked, missingPrerequisites } = isMissionUnlocked(
            mission,
            save.completed
          );
          const comp = save.completed[mission.id];
          const hasDraft = Boolean(save.drafts[mission.id]);
          const stars = comp ? scoreToStars(comp.bestScore) : 0;

          return (
            <article
              key={mission.id}
              className={`bq-mission-card ${!unlocked ? 'locked' : ''} ${
                comp ? 'completed' : ''
              }`}
              data-testid={`mission-card-${mission.id}`}
            >
              <div className="bq-card-top">
                <span className="bq-mission-step">
                  GÖREV {mission.id.replace('m', '')}
                </span>
                <span className="bq-mission-stars" aria-label={`${stars} / 3 Yıldız`}>
                  {[1, 2, 3].map((s) => (
                    <span
                      key={s}
                      className={`bq-card-star ${s <= stars ? 'earned' : ''}`}
                    >
                      ★
                    </span>
                  ))}
                </span>
                <span className="bq-mission-time">{mission.estimatedMinutes} dk</span>
              </div>

              <h2 className="bq-mission-title">{mission.title}</h2>

              {!unlocked ? (
                <div
                  className="bq-lock-notice"
                  data-testid={`mission-lock-${mission.id}`}
                >
                  🔒 Önce <strong>{missingPrerequisites.join(', ')}</strong> görevini tamamla
                </div>
              ) : (
                <div className="bq-card-actions">
                  {hasDraft ? (
                    <>
                      <button
                        type="button"
                        className="bq-btn bq-btn-primary"
                        data-testid={`continue-mission-${mission.id}`}
                        onClick={() => {
                          playSound('click');
                          onStartMission(mission.id, true);
                        }}
                      >
                        ▶ Devam Et
                      </button>
                      <button
                        type="button"
                        className="bq-btn bq-btn-secondary"
                        data-testid={`start-fresh-mission-${mission.id}`}
                        onClick={() => {
                          playSound('click');
                          onStartMission(mission.id, false);
                        }}
                      >
                        Sıfırdan
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="bq-btn bq-btn-primary bq-btn-full"
                      data-testid={`start-mission-${mission.id}`}
                      onClick={() => {
                        playSound('click');
                        onStartMission(mission.id, true);
                      }}
                    >
                      {comp ? '↻ Tekrar Oyna' : '▶ Göreve Başla'}
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>

      {/* Collapsible Data & Settings Bar (Always in DOM for tests, compact layout) */}
      <section
        ref={settingsRef}
        className={`bq-dash-settings ${settingsOpen ? 'open' : ''}`}
        aria-label="Ayarlar ve Veri Yönetimi"
      >
        <div className="bq-settings-group">
          <h3>Tercihler & Kayıt Yönetimi</h3>
          {reminderNote && (
            <p className="bq-sched-note" role="status" data-testid="reminder-note">{reminderNote}</p>
          )}
          <div className="bq-settings-row">
            <label className="bq-toggle-label">
              <input
                type="checkbox"
                checked={save.settings.reducedMotion}
                onChange={(e) =>
                  onUpdateSettings({ reducedMotion: e.target.checked })
                }
                data-testid="toggle-reduced-motion"
              />
              <span>Azaltılmış Hareket</span>
            </label>
            <label className="bq-toggle-label">
              <input
                type="checkbox"
                checked={save.settings.sound}
                onChange={(e) => onUpdateSettings({ sound: e.target.checked })}
                data-testid="toggle-sound"
              />
              <span>Ses Efektleri</span>
            </label>
            <label className="bq-toggle-label">
              <input
                type="checkbox"
                checked={!meta.hapticsOff}
                onChange={(e) => onSetHaptics(e.target.checked)}
                data-testid="toggle-haptics"
              />
              <span>Titreşim</span>
            </label>
            <label className="bq-toggle-label">
              <input
                type="checkbox"
                checked={meta.reminderHour !== null}
                onChange={async (e) => {
                  const res = await onSetReminder(e.target.checked);
                  setReminderNote(
                    res.ok
                      ? null
                      : res.reason === 'web'
                      ? 'Hatırlatma yalnızca iPhone/iPad uygulamasında çalışır.'
                      : 'Bildirim izni verilmedi. Ayarlar → Bildirimler’den açabilirsin.'
                  );
                }}
                data-testid="toggle-reminder"
              />
              <span>Günlük hatırlatma (19:00)</span>
            </label>
          </div>
        </div>

        <div className="bq-settings-group" data-testid="my-stats">
          <h3>İstatistiklerim (yalnızca bu cihazda)</h3>
          {statsSummary.attempts === 0 ? (
            <p className="bq-sched-note">Henüz kontrol yapmadın.</p>
          ) : (
            <ul className="bq-stats-list">
              <li>Toplam kontrol: <strong>{statsSummary.attempts}</strong></li>
              <li>İlk bakışta başarı oranı: <strong>%{statsSummary.passRatePct}</strong></li>
              {statsSummary.hardest && (
                <li>
                  En çok uğraştığın görev:{' '}
                  <strong>
                    {statsSummary.hardest.id.toUpperCase()} ({statsSummary.hardest.attempts} deneme)
                  </strong>
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="bq-settings-group bq-settings-actions-col">
          <button
            type="button"
            className="bq-btn bq-btn-secondary bq-btn-compact"
            data-testid="about-btn"
            onClick={() => setAboutOpen(true)}
          >
            Hakkında & Gizlilik
          </button>
          <button
            type="button"
            className="bq-btn bq-btn-secondary bq-btn-compact"
            data-testid="export-save-btn"
            onClick={onExportSave}
          >
            ⬇ Kaydı Dışa Aktar (JSON)
          </button>
          <button
            type="button"
            className="bq-btn bq-btn-secondary bq-btn-compact"
            data-testid="import-save-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            ⬆ Kaydı İçe Aktar
          </button>

          {!confirmClearOpen ? (
            <button
              type="button"
              className="bq-btn bq-btn-danger-outline bq-btn-compact"
              data-testid="clear-all-data-btn"
              onClick={() => setConfirmClearOpen(true)}
            >
              Sıfırla
            </button>
          ) : (
            <div
              className="bq-inline-confirm"
              role="alertdialog"
              aria-label="Tüm Verileri Sıfırlama Onayı"
            >
              <span>Silinsin mi?</span>
              <button
                type="button"
                className="bq-btn bq-btn-danger bq-btn-compact"
                data-testid="confirm-clear-all-btn"
                onClick={() => {
                  onClearAllData();
                  setConfirmClearOpen(false);
                }}
              >
                Evet, Sil
              </button>
              <button
                type="button"
                className="bq-btn bq-btn-secondary bq-btn-compact"
                onClick={() => setConfirmClearOpen(false)}
              >
                İptal
              </button>
            </div>
          )}
        </div>
      </section>

      {menuOpen && (
        <div
          className="bq-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Diğer seçenekler"
          data-testid="dash-menu"
          onClick={() => setMenuOpen(false)}
        >
          <div className="bq-modal-card bq-menu-card" onClick={(e) => e.stopPropagation()}>
            <div className="bq-form-title-row">
              <h2>Seçenekler</h2>
              <button type="button" className="bq-chip-btn" onClick={() => setMenuOpen(false)}>
                ✕ Kapat
              </button>
            </div>
            <div className="bq-menu-group">
              <button type="button" className="bq-menu-item" data-testid="dashboard-info-btn" onClick={() => pick(() => setInfoModalOpen(true))}>
                <span aria-hidden="true">ⓘ</span> Nasıl oynanır?
              </button>
              <button type="button" className="bq-menu-item" data-testid="help-btn" onClick={() => pick(() => setHelpOpen(true))}>
                <span aria-hidden="true">📖</span> Revit sözlüğü ve kısayollar
              </button>
              <button type="button" className="bq-menu-item" data-testid="theme-toggle-btn" onClick={() => pick(onToggleTheme)}>
                <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span> {theme === 'dark' ? 'Açık tema' : 'Koyu tema'}
              </button>
              <button
                type="button"
                className="bq-menu-item"
                data-testid="settings-toggle-btn"
                onClick={() =>
                  pick(() => {
                    setSettingsOpen(true);
                    window.setTimeout(() => settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                  })
                }
              >
                <span aria-hidden="true">⚙️</span> Ayarlar, kayıt ve gizlilik
              </button>
            </div>
          </div>
        </div>
      )}
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />

      {aboutOpen && <AboutSheet onClose={() => setAboutOpen(false)} />}

      {certificateOpen && (
        <CertificateSheet
          completed={save.completed}
          name={meta.playerName}
          onNameChange={onSetPlayerName}
          onClose={() => setCertificateOpen(false)}
        />
      )}

      {achievementsOpen && (
        <div
          className="bq-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ach-title"
          data-testid="achievements-modal"
          onClick={() => setAchievementsOpen(false)}
        >
          <div className="bq-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="bq-form-title-row">
              <h2 id="ach-title">🏅 Başarımlar ({earnedIds.length}/{ACHIEVEMENTS.length})</h2>
              <button type="button" className="bq-chip-btn" onClick={() => setAchievementsOpen(false)}>
                ✕ Kapat
              </button>
            </div>
            <ul className="bq-ach-list">
              {ACHIEVEMENTS.map((a) => {
                const got = earnedIds.includes(a.id);
                return (
                  <li key={a.id} className={`bq-ach-item ${got ? 'earned' : ''}`} data-testid={`ach-${a.id}`}>
                    <span className="bq-ach-icon" aria-hidden="true">{got ? a.icon : '🔒'}</span>
                    <span>
                      <strong>{a.title}</strong>
                      <small>{a.description}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* `i` (Nasıl Oynanır & BIM Rehberi) Modal */}
      {infoModalOpen && (
        <div
          className="bq-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dash-info-title"
          data-testid="dashboard-info-modal"
          onClick={() => setInfoModalOpen(false)}
        >
          <div className="bq-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="bq-form-title-row">
              <h2 id="dash-info-title">ⓘ BIM QUEST Nasıl Oynanır?</h2>
              <button
                type="button"
                className="bq-chip-btn"
                onClick={() => setInfoModalOpen(false)}
              >
                ✕ Kapat
              </button>
            </div>
            <ul className="bq-info-modal-list">
              <li>
                <strong>1. Öğren (ⓘ):</strong> Görev içindeki <code>i</code> butonuna dokunarak o adımdaki mimari kuralın mantığını tek bakışta gör.
              </li>
              <li>
                <strong>2. Uygula:</strong> 2B Plan ve 3B Sahne üzerinde duvarları çiz, uçlarından sürükle veya sağ panelden milimetrik ölçü gir.
              </li>
              <li>
                <strong>3. Kontrol Et & Düzelt:</strong> Turuncu <strong>Kontrol et</strong> butonuna bas. Hata varsa sistem neden yanlış olduğunu ve nasıl düzelteceğini söyler.
              </li>
              <li>
                <strong>4. XP & Rozet Kazan:</strong> Doğru modelle <strong>+200 XP</strong> ve Altın Rozet kazanarak 65 görevlik haritada ilerle!
              </li>
            </ul>
            <div className="bq-modal-actions">
              <button
                type="button"
                className="bq-btn bq-btn-primary"
                data-testid="close-info-modal-btn"
                onClick={() => setInfoModalOpen(false)}
              >
                Anladım, Başlayalım!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
