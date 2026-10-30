import React, { useRef, useState } from 'react';
import {
  SIX_CHAPTER_CURRICULUM,
  getTotalCurriculumMissionCount,
} from '../content/curriculum';
import {
  calculateMissionXp,
  calculateTotalPlayerXp,
} from '../domain/pedagogy';
import { isMissionUnlocked } from '../domain/persistence';
import { ACHIEVEMENTS, earnedAchievementIds, levelProgress, summarizeStats, type GameMeta } from '../domain/gameMeta';
import { CHAPTER_STORIES, MENTOR_LINES, STORY_MENTOR, STORY_PROJECT } from '../content/story';
import type {
  BadgeType,
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

function badgeLabelTr(badge: BadgeType): string {
  if (badge === 'gold') return 'Altın Rozet';
  if (badge === 'silver') return 'Gümüş Rozet';
  if (badge === 'bronze') return 'Bronz Rozet';
  return '';
}

function scoreToBadge(score: number): BadgeType {
  if (score >= 90) return 'gold';
  if (score >= 75) return 'silver';
  return 'bronze';
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
  streak,
  meta,
  onSetPlayerName,
  onStartWorkshop,
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
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [selectedStageChapterId, setSelectedStageChapterId] = useState<string>('ch01');
  const [expandedChapterId, setExpandedChapterId] = useState<string>('');
  const [infoModalOpen, setInfoModalOpen] = useState(initialInfoOpen);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [certificateOpen, setCertificateOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
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
  const xpStats = calculateTotalPlayerXp(save.completed);
  const totalCurriculumCount = getTotalCurriculumMissionCount();

  const progress = levelProgress(save.completed);
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
        <div className="bq-brand-row">
          <button
            type="button"
            className="bq-brand-btn"
            data-testid="brand-title-btn"
            onClick={onBackToTitle}
            disabled={!onBackToTitle}
            aria-label="Ana ekrana dön"
          >
            <img
              src="./assets/brand/logo-horizontal.svg"
              alt="BIM QUEST"
              className="bq-brand-logo"
              width={240}
              height={48}
            />
          </button>
        </div>

        {/* Compact Player HUD Stats & Quick Controls */}
        <div className="bq-dash-actions" data-testid="progress-summary">
          <div className="bq-hud-pill" data-testid="player-xp-summary">
            <span className="bq-hud-xp">⚡ {xpStats.totalXp} XP</span>
            <span className="bq-hud-sep">·</span>
            <span>Sv.{xpStats.level} {xpStats.rankTitle}</span>
          </div>

          <div className="bq-hud-pill" data-testid="mission-count-pill">
            ✓ {completedCount} / {missions.length} görev
          </div>

          {streak > 0 && (
            <div className="bq-hud-pill" data-testid="streak-pill" title="Üst üste oynadığın gün sayısı">
              🔥 {streak} gün
            </div>
          )}

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

          <button
            type="button"
            className="bq-icon-pill-btn"
            data-testid="dashboard-info-btn"
            onClick={() => setInfoModalOpen(true)}
            aria-label="Nasıl Oynanır?"
            title="Oyun Rehberi & Nasıl Oynanır (ⓘ)"
          >
            <span className="bq-i-badge">i</span>
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

          <HelpSheet />

          <button
            type="button"
            className="bq-icon-pill-btn"
            data-testid="theme-toggle-btn"
            onClick={onToggleTheme}
            aria-label="Tema değiştir"
            title="Koyu / Açık Tema Değiştir"
          >
            <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>

          <button
            type="button"
            className="bq-icon-pill-btn"
            data-testid="settings-toggle-btn"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Kayıt ve Ayarlar"
            title="Kayıt & Ayarlar"
          >
            <span>⚙️</span>
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

        <div className="bq-level-bar" data-testid="level-bar" aria-label={`Seviye ${progress.level} ilerlemesi`}>
          <span className="bq-level-bar-fill" style={{ width: `${progress.pct}%` }} />
          <span className="bq-level-bar-txt">
            Sv.{progress.level} → {progress.level + 1} · {progress.intoLevel}/{progress.perLevel} XP
          </span>
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
        <div className="bq-hero-mentor" aria-hidden="true">👷</div>
        <div className="bq-hero-body">
          <span className="bq-hero-kicker">{STORY_PROJECT}</span>
          {allDone ? (
            <>
              <h2>Proje teslim edildi!</h2>
              <p>{STORY_MENTOR}: “{MENTOR_LINES.done}”</p>
            </>
          ) : nextMission ? (
            <>
              <h2>
                {completedCount === 0 ? 'İlk görevin' : 'Sıradaki görev'}:{' '}
                {nextMission.title}
              </h2>
              <p>
                {STORY_MENTOR}: “
                {completedCount === 0 ? MENTOR_LINES.start : MENTOR_LINES.return}{' '}
                {nextChapter ? CHAPTER_STORIES[nextChapter.id] : ''}”
              </p>
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
          <p className="bq-chapter-story">“{CHAPTER_STORIES[activeChapter.id]}”</p>
          <p>{activeChapter.pedagogyNote} — {activeChapter.subtitle}</p>
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

        {/* Connected Blueprint Progress Track for Active Chapter */}
        <div className="bq-route-track" aria-label="Bölüm Görev İlerleme Yolu">
          {visibleMissions.map((m) => {
            const comp = save.completed[m.id];
            const { unlocked } = isMissionUnlocked(m, save.completed);
            const stars = comp ? scoreToStars(comp.bestScore) : 0;
            const numStr = m.id.replace('m', '');
            return (
              <React.Fragment key={m.id}>
                <div
                  className={`bq-route-node ${
                    comp ? 'done' : unlocked ? 'active' : 'locked'
                  }`}
                >
                  <span className="bq-route-num">
                    {comp ? '✓' : numStr}
                  </span>
                  <span className="bq-route-stars" aria-hidden="true">
                    {comp ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '☆☆☆'}
                  </span>
                </div>
                <span
                  className={`bq-route-line ${comp ? 'done' : ''}`}
                  aria-hidden="true"
                />
              </React.Fragment>
            );
          })}
        </div>

        <button
          type="button"
          className="bq-icon-pill-btn"
          onClick={() => {
            playSound('click');
            setInfoModalOpen(true);
          }}
        >
          <span className="bq-i-badge">i</span>
          <span>BIM Nedir?</span>
        </button>
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
          const badge = comp ? scoreToBadge(comp.bestScore) : null;
          const stars = comp ? scoreToStars(comp.bestScore) : 0;
          const earnedXp = comp ? calculateMissionXp(comp.bestScore) : 0;
          const metaSummary = activeChapter.missions.find(
            (cm) => cm.id === mission.id
          );

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
                <span className="bq-mission-time">
                  ⏱️ {mission.estimatedMinutes} dk · ⚡ 200 XP
                </span>
              </div>

              <h2 className="bq-mission-title">{mission.title}</h2>
              {metaSummary && (
                <div className="bq-card-revit-path">
                  <code>{metaSummary.revitPath}</code>
                </div>
              )}
              <p className="bq-mission-obj">{mission.objective}</p>

              <div className="bq-card-status">
                {comp ? (
                  <div
                    className="bq-score-pill"
                    data-testid={`mission-score-${mission.id}`}
                  >
                    <strong>
                      ★ {comp.bestScore} Puan (+{earnedXp} XP)
                    </strong>
                    {badge && (
                      <span className={`bq-badge bq-badge-${badge}`}>
                        {badgeLabelTr(badge)}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="bq-status-pending">
                    Ödül: +200 XP · ★★★ & Rozet
                  </span>
                )}
              </div>

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

      {/* Compact 9-Chapter / 58-Mission Roadmap Accordion */}
      <section
        className="bq-curriculum-section"
        aria-label="9 Bölüm ve 58 Görevlik Revit Eğitim Mimarisi"
        data-testid="curriculum-chapters"
      >
        <div className="bq-curriculum-header">
          <div className="bq-curriculum-title-row">
            <h2>🗺️ 7 Bölüm · {totalCurriculumCount} Görev</h2>
            <span className="bq-chip-tag">Bölüm seçerek tüm görevleri incele ve oyna</span>
          </div>
        </div>

        <div className="bq-chapters-list">
          {SIX_CHAPTER_CURRICULUM.map((chapter) => {
            const isExpanded = expandedChapterId === chapter.id;
            const completedInChapter = chapter.missions.filter(
              (m) => m.id in save.completed
            ).length;

            return (
              <div
                key={chapter.id}
                className={`bq-chapter-card ${isExpanded ? 'expanded' : ''}`}
                data-testid={`chapter-card-${chapter.id}`}
              >
                <button
                  type="button"
                  className="bq-chapter-toggle"
                  data-testid={`chapter-toggle-${chapter.id}`}
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedChapterId((prev) =>
                      prev === chapter.id ? '' : chapter.id
                    )
                  }
                >
                  <div className="bq-chapter-title-col">
                    <span className="bq-chapter-badge">
                      {chapter.missionRangeLabel}
                    </span>
                    <strong>{chapter.title}</strong>
                  </div>
                  <div className="bq-chapter-meta-col">
                    <span className="bq-chapter-count">
                      {completedInChapter}/{chapter.missions.length}
                    </span>
                    <span aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
                  </div>
                </button>

                {isExpanded && (
                  <ul className="bq-chapter-missions">
                    {chapter.missions.map((m) => {
                      const liveTask = missions.find((t) => t.id === m.id);
                      const isDone = Boolean(save.completed[m.id]);
                      const unlockInfo = liveTask
                        ? isMissionUnlocked(liveTask, save.completed)
                        : { unlocked: false, missingPrerequisites: [] };

                      return (
                        <li
                          key={m.id}
                          className={`bq-chapter-mission-row ${
                            m.playableInPrototype ? 'playable' : 'planned'
                          }`}
                          data-testid={`curriculum-mission-${m.id}`}
                        >
                          <span className="bq-cm-id">{m.id.toUpperCase()}</span>
                          <div className="bq-cm-info">
                            <strong>{m.title}</strong>
                            <span>{m.focusConcept} · <code>{m.revitPath}</code></span>
                          </div>
                          <div className="bq-cm-status">
                            {liveTask ? (
                              isDone ? (
                                <button
                                  type="button"
                                  className="bq-btn bq-btn-secondary bq-btn-compact"
                                  onClick={() => onStartMission(m.id, true)}
                                >
                                  ✓ {save.completed[m.id].bestScore} Puan (Tekrar)
                                </button>
                              ) : unlockInfo.unlocked ? (
                                <button
                                  type="button"
                                  className="bq-btn bq-btn-primary bq-btn-compact"
                                  onClick={() => onStartMission(m.id, true)}
                                >
                                  Oyna
                                </button>
                              ) : (
                                <span className="bq-cm-pill locked">
                                  🔒 {unlockInfo.missingPrerequisites.join(', ')}
                                </span>
                              )
                            ) : (
                              <span className="bq-cm-pill roadmap">Yakında</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Collapsible Data & Settings Bar (Always in DOM for tests, compact layout) */}
      <section
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
                <strong>4. XP & Rozet Kazan:</strong> Doğru modelle <strong>+200 XP</strong> ve Altın Rozet kazanarak 58 görevlik haritada ilerle!
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
