import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Point } from '../domain/types';
import { playSound } from '../ui/sound';
import { CampaignPlan } from './CampaignPlan';
import { ElevationView } from './ElevationView';
import { RibbonIcon } from './RibbonIcon';
import {
  currentStep,
  nameRoom,
  newPlay,
  pasteTo,
  pickCommand,
  setDrawMode,
  starsFor,
  stepLevel,
  tap,
  undo,
  type Effect,
  type PlayState,
  type TapResult,
} from './engine';
import {
  CAMPAIGN_TASK,
  RIBBON,
  RIBBON_TABS,
  commandById,
  levelName,
  sessionFor,
  startModelFor,
  type CommandId,
  type HouseDef,
  type LevelDef,
  type RibbonTab,
} from './model';
import { UI, tx, type Locale } from './i18n';
import { houseStars, isUnlocked, recordStars, type CampaignProgress } from './progress';
import { buildSection } from '../domain/viewDrawing';
import { DrawingSvg } from '../plan/DrawingSvg';
import './campaign.css';

const SceneViewport = lazy(() => import('../scene/SceneViewport').then((m) => ({ default: m.SceneViewport })));

/** Turkish first; English is a matter of filling the `en` fields and flipping this. */
const L: Locale = 'tr';
const t = (k: keyof typeof UI) => tx(UI[k], L);

const EMPTY_FAILED = new Set<string>();

interface Props {
  house: HouseDef;
  progress: CampaignProgress;
  onProgress: (p: CampaignProgress) => void;
  theme: 'light' | 'dark';
  reducedMotion: boolean;
  onExit: () => void;
}

const Stars: React.FC<{ n: number; of?: number; className?: string }> = ({ n, of = 3, className }) => (
  <span className={`bq-cmp-stars ${className ?? ''}`} aria-label={`${n} / ${of} ${t('stars')}`}>
    {Array.from({ length: of }, (_, i) => (
      <span key={i} className={i < n ? 'on' : 'off'} aria-hidden="true">★</span>
    ))}
  </span>
);

const sound = (e: Effect | undefined) => {
  if (e) playSound(e);
};

export const CampaignScreen: React.FC<Props> = ({ house, progress, onProgress, theme, reducedMotion, onExit }) => {
  const [levelIndex, setLevelIndex] = useState<number | null>(null);
  const [houseDone, setHouseDone] = useState(false);
  const [round, setRound] = useState(0);
  const levels = house.levels;

  if (houseDone) {
    return (
      <HouseComplete
        house={house}
        progress={progress}
        theme={theme}
        onBack={() => {
          setHouseDone(false);
          setLevelIndex(null);
        }}
      />
    );
  }

  if (levelIndex === null) {
    return <Hub house={house} progress={progress} onExit={onExit} onPlay={setLevelIndex} />;
  }

  return (
    <LevelPlay
      key={`${levelIndex}-${round}`}
      house={house}
      levelIndex={levelIndex}
      theme={theme}
      reducedMotion={reducedMotion}
      onFinish={(stars) => onProgress(recordStars(progress, levels[levelIndex].id, stars))}
      onExit={() => setLevelIndex(null)}
      onNext={() => {
        if (levelIndex + 1 < levels.length) setLevelIndex(levelIndex + 1);
        else setHouseDone(true);
      }}
      onReplay={() => setRound((r) => r + 1)}
    />
  );
};

// ---------------------------------------------------------------------------
// Hub: the levels of one house
// ---------------------------------------------------------------------------

const Hub: React.FC<{ house: HouseDef; progress: CampaignProgress; onExit: () => void; onPlay: (i: number) => void }> = ({
  house,
  progress,
  onExit,
  onPlay,
}) => {
  const levels = house.levels;
  const next = levels.findIndex((l) => !progress.stars[l.id]);
  return (
    <div className="bq-cmp-hub" data-testid="campaign-hub">
      <header className="bq-cmp-hub-head">
        <button type="button" className="bq-cmp-icon-btn" onClick={onExit} data-testid="campaign-exit-btn">
          {t('back')}
        </button>
        <div className="bq-cmp-hub-title">
          <h1>{tx(house.title, L)}</h1>
          <p>{tx(house.brief, L)}</p>
        </div>
        <span className="bq-cmp-hub-total" data-testid="campaign-total-stars">
          ★ {houseStars(house, progress)} / {levels.length * 3}
        </span>
      </header>
      <ol className="bq-cmp-levels">
        {levels.map((l, i) => {
          const open = isUnlocked(house, progress, i);
          const stars = progress.stars[l.id] ?? 0;
          return (
            <li key={l.id}>
              <button
                type="button"
                className={`bq-cmp-level-tile ${i === next ? 'next' : ''} ${stars ? 'done' : ''}`}
                disabled={!open}
                data-testid={`campaign-level-${l.number}`}
                aria-label={`${t('level')} ${l.number}: ${tx(l.title, L)}${open ? '' : ` — ${t('locked')}`}`}
                onClick={() => {
                  playSound('click');
                  onPlay(i);
                }}
              >
                <span className="bq-cmp-level-num">{l.number}</span>
                <span className="bq-cmp-level-name">{tx(l.title, L)}</span>
                <span className="bq-cmp-level-cmds">
                  {[...new Set(l.steps.map((s) => s.command))].map((c) => (
                    <RibbonIcon key={c} id={c} />
                  ))}
                </span>
                {open ? <Stars n={stars} /> : <span className="bq-cmp-lock" aria-hidden="true">🔒</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="bq-cmp-hub-foot">{t('starsInfo')}</p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// One level
// ---------------------------------------------------------------------------

interface LevelProps {
  house: HouseDef;
  levelIndex: number;
  theme: 'light' | 'dark';
  reducedMotion: boolean;
  onFinish: (stars: number) => void;
  onExit: () => void;
  onNext: () => void;
  onReplay: () => void;
}

const LevelPlay: React.FC<LevelProps> = ({ house, levelIndex, theme, reducedMotion, onFinish, onExit, onNext, onReplay }) => {
  const level: LevelDef = house.levels[levelIndex];
  const isLast = levelIndex + 1 >= house.levels.length;
  const [play, setPlay] = useState<PlayState>(() => newPlay(sessionFor(startModelFor(house, levelIndex))));
  const [tab, setTab] = useState<RibbonTab>('architecture');
  const [toast, setToast] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [bigPreview, setBigPreview] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [demoFrame, setDemoFrame] = useState<number>(-1);
  const step = currentStep(level, play);
  const toastTimer = useRef<number | undefined>(undefined);

  const say = useCallback((msg: string | null | undefined) => {
    if (!msg) return;
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // Demo: a finger shows the taps of each new step once, unless motion is reduced.
  const seenDemo = useRef<Set<string>>(new Set());
  const startDemo = useCallback(() => {
    if (step.demo.length === 0) return;
    setDemoFrame(0);
  }, [step]);
  useEffect(() => {
    if (play.done || reducedMotion || seenDemo.current.has(step.id)) return;
    const id = window.setTimeout(() => {
      seenDemo.current.add(step.id);
      startDemo();
    }, 350);
    return () => window.clearTimeout(id);
  }, [step.id, play.done, reducedMotion, startDemo]);
  useEffect(() => {
    if (demoFrame < 0) return;
    const id = window.setTimeout(
      () => setDemoFrame((f) => (f + 1 < step.demo.length + 1 ? f + 1 : -1)),
      demoFrame === 0 ? 900 : 750
    );
    return () => window.clearTimeout(id);
  }, [demoFrame, step.demo.length]);
  const demoActive = demoFrame >= 0;
  const demoPoint: Point | null = demoActive ? step.demo[Math.min(demoFrame, step.demo.length - 1)] : null;

  // The correct command glows during the demo and after two wrong picks.
  const wantCmd = step.command;
  const hint = !play.done && !play.command && (demoActive || play.wrongPicks >= 2);
  const wantTab = commandById(wantCmd).tab;

  // Level finished: record, then show the card after a beat.
  const stars = starsFor(level, play);
  const finishedOnce = useRef(false);
  useEffect(() => {
    if (!play.done || finishedOnce.current) return;
    finishedOnce.current = true;
    onFinish(stars);
  }, [play.done, stars, onFinish]);
  useEffect(() => {
    if (!play.done) return;
    const id = window.setTimeout(() => setShowCard(true), reducedMotion ? 0 : 700);
    return () => window.clearTimeout(id);
  }, [play.done, reducedMotion]);

  const apply = (r: TapResult) => {
    setPlay(r.state);
    sound(r.effect);
    say(r.message);
  };

  const onPick = (id: CommandId) => {
    setDemoFrame(-1);
    if (play.done) return;
    const r = pickCommand(level, play, id);
    apply(r);
    if (r.effect === 'error') say(r.state.wrongPicks >= 2 ? t('wrongCommandHint') : t('wrongCommand'));
  };

  const onTapPlan = (p: Point) => {
    setDemoFrame(-1);
    if (play.done) return;
    if (!play.command) {
      sound('error');
      say(t('pickCommand'));
      return;
    }
    apply(tap(level, play, p));
  };

  const chainStart = play.chain.start ?? play.firstTap;
  const activeLevel = stepLevel(step);
  const model = play.session.model;
  const section = level.reveal === 'section' ? [...model.elements].reverse().find((e) => e.type === 'view' && e.kind === 'section') : undefined;
  const ghosts = play.done ? [] : step.ghost;
  const usedCommands = useMemo(() => [...new Set(level.steps.map((s) => s.command))].map(commandById), [level]);
  const hasModel = play.session.model.elements.length > 0;
  const namingRoom = play.namingRoomId ? play.session.model.elements.find((e) => e.id === play.namingRoomId) : null;

  return (
    <div className={`bq-cmp-play view-${level.view}`} data-testid="campaign-level">
      <header className="bq-cmp-top">
        <button type="button" className="bq-cmp-icon-btn" onClick={onExit} data-testid="campaign-level-exit">
          {t('back')}
        </button>
        <h1 className="bq-cmp-title">
          <span>{t('level')} {level.number}</span> {tx(level.title, L)}
        </h1>
        <button type="button" className="bq-cmp-icon-btn" onClick={() => setWhyOpen(true)} data-testid="campaign-why-btn">
          {t('why')}
        </button>
      </header>

      <div className="bq-cmp-goal" data-testid="campaign-goal" aria-live="polite">
        {level.steps.length > 1 && (
          <span className="bq-cmp-step-count">
            {t('step')} {Math.min(play.stepIndex + 1, level.steps.length)}/{level.steps.length}
          </span>
        )}
        <span className="bq-cmp-goal-text">{play.done ? t('levelDone') : tx(step.goal, L)}</span>
        {!play.done &&
          (demoActive ? (
            <button type="button" className="bq-cmp-chip" onClick={() => setDemoFrame(-1)} data-testid="campaign-skip-demo">
              {t('skipDemo')}
            </button>
          ) : (
            <button type="button" className="bq-cmp-chip" onClick={startDemo} data-testid="campaign-watch-demo">
              ▶ {t('watch')}
            </button>
          ))}
      </div>

      <nav className="bq-cmp-ribbon" aria-label={t('ribbon')} data-testid="campaign-ribbon">
        <div className="bq-cmp-tabs" role="tablist">
          {RIBBON_TABS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={`bq-cmp-tab ${tab === k ? 'active' : ''} ${hint && wantTab === k && tab !== k ? 'hint' : ''}`}
              onClick={() => {
                playSound('click');
                setTab(k);
              }}
              data-testid={`campaign-tab-${k}`}
            >
              {t(k)}
            </button>
          ))}
        </div>
        <div className="bq-cmp-panels">
          {[...new Set(RIBBON.filter((c) => c.tab === tab).map((c) => c.panel))].map((panel) => (
            <div className="bq-cmp-panel" key={panel}>
              <div className="bq-cmp-panel-btns">
                {RIBBON.filter((c) => c.tab === tab && c.panel === panel).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`bq-cmp-cmd ${play.command === c.id ? 'active' : ''} ${hint && wantCmd === c.id ? 'hint' : ''}`}
                    aria-pressed={play.command === c.id}
                    onClick={() => onPick(c.id)}
                    data-testid={`campaign-cmd-${c.id}`}
                    title={c.path + (c.shortcut ? ` (${c.shortcut})` : '')}
                  >
                    <RibbonIcon id={c.id} />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
              <span className="bq-cmp-panel-name">{panel}</span>
            </div>
          ))}
        </div>
      </nav>

      <main className={`bq-cmp-stage ${hasModel ? 'with-preview' : ''}`}>
        <div className="bq-cmp-canvas">
        <span className="bq-cmp-view-badge" data-testid="campaign-view-name">
          {level.view === 'elevation' ? t('elevationView') : `${t('floorPlan')}: ${levelName(model, activeLevel)}`}
        </span>
        {play.command === 'wall' && (
          <div className="bq-cmp-draw" role="group" aria-label="Draw" data-testid="campaign-draw">
            {(['line', 'rect'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`bq-cmp-chip ${play.drawMode === m ? 'active' : ''}`}
                aria-pressed={play.drawMode === m}
                onClick={() => apply(setDrawMode(play, m))}
                data-testid={`campaign-draw-${m}`}
              >
                {m === 'line' ? '╱ Line' : '▭ Rectangle'}
              </button>
            ))}
          </div>
        )}
        {level.view === 'elevation' ? (
          <ElevationView model={play.session.model} ghosts={ghosts} demo={demoPoint} onTap={onTapPlan} />
        ) : (
          <CampaignPlan
            geom={level.geom}
            activeLevel={activeLevel}
            model={play.session.model}
            ghosts={ghosts}
            showDots={!!play.command && ['grid', 'wall', 'section'].includes(play.command)}
            chainStart={chainStart}
            demo={demoPoint}
            onTap={onTapPlan}
          />
        )}
        </div>

        {hasModel && (
          <div className={`bq-cmp-preview ${bigPreview ? 'big' : ''}`} data-testid="campaign-preview">
            <Suspense fallback={null}>
              <SceneViewport
                task={CAMPAIGN_TASK}
                model={play.session.model}
                selectedId={null}
                failedElementIds={EMPTY_FAILED}
                reducedMotion={reducedMotion}
                isVisible
                theme={theme}
                onSelect={() => undefined}
                minimal
              />
            </Suspense>
            <button
              type="button"
              className="bq-cmp-preview-btn"
              onClick={() => setBigPreview((v) => !v)}
              aria-label={bigPreview ? t('close') : t('open3d')}
              data-testid="campaign-preview-toggle"
            >
              {bigPreview ? '✕' : t('preview3d')}
            </button>
          </div>
        )}

        {toast && (
          <div className="bq-cmp-toast" role="status" data-testid="campaign-toast">
            {toast}
          </div>
        )}
      </main>

      <footer className="bq-cmp-bottom">
        <button
          type="button"
          className="bq-cmp-icon-btn"
          onClick={() => apply(undo(level, play))}
          disabled={play.done || play.session.past.length === 0}
          data-testid="campaign-undo"
        >
          ↶ {t('undo')}
        </button>
        <span className={`bq-cmp-moves ${play.taps > level.par ? 'over' : ''}`} data-testid="campaign-moves">
          {t('moves')} {play.taps}/{level.par}
        </span>
        <Stars n={1 + (play.wrongPicks === 0 ? 1 : 0) + (play.taps <= level.par ? 1 : 0)} className="live" />
      </footer>

      {namingRoom && namingRoom.type === 'room' && (
        <div className="bq-cmp-sheet" role="dialog" aria-label={t('nameRoom')} data-testid="campaign-name-sheet">
          <strong>{t('nameRoom')}</strong>
          <div className="bq-cmp-name-chips">
            {house.nameChoices.map((n) => (
              <button
                key={n}
                type="button"
                className="bq-cmp-chip big"
                onClick={() => apply(nameRoom(level, play, n))}
                data-testid={`campaign-name-${n}`}
              >
                {n}
              </button>
            ))}
          </div>
          <small>{t('namePickHint')}</small>
        </div>
      )}

      {play.command === 'paste' && !play.done && (
        <div className="bq-cmp-sheet" role="dialog" aria-label={t('pasteTitle')} data-testid="campaign-paste-sheet">
          <strong>{t('pasteTitle')}</strong>
          <div className="bq-cmp-name-chips">
            {model.levels
              .filter((l) => l.id !== (step.from ?? 'l0'))
              .map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="bq-cmp-chip big"
                  onClick={() => apply(pasteTo(level, play, l.id))}
                  data-testid={`campaign-paste-${l.id}`}
                >
                  {l.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {whyOpen && (
        <div className="bq-cmp-modal-back" onClick={() => setWhyOpen(false)}>
          <div className="bq-cmp-modal" role="dialog" aria-label={t('whyTitle')} onClick={(e) => e.stopPropagation()} data-testid="campaign-why">
            <h2>{t('whyTitle')}</h2>
            <p>{tx(level.why, L)}</p>
            <p className="bq-cmp-bridge">
              <strong>{t('fromAutocad')}:</strong> {tx(level.bridge, L)}
            </p>
            <button type="button" className="bq-cmp-primary" onClick={() => setWhyOpen(false)}>
              {t('close')}
            </button>
          </div>
        </div>
      )}

      {showCard && (
        <div className="bq-cmp-modal-back">
          <div className="bq-cmp-modal bq-cmp-done" role="dialog" aria-label={t('levelDone')} data-testid="campaign-level-done">
            <h2>{t('levelDone')}</h2>
            <AnimatedStars n={stars} reducedMotion={reducedMotion} />
            {section && section.type === 'view' && (
              <div className="bq-cmp-reveal" data-testid="campaign-reveal">
                <DrawingSvg drawing={buildSection(model, section)} isDark={theme === 'dark'} title={section.name} />
                <small>{section.name}</small>
              </div>
            )}
            <section className="bq-cmp-inrevit">
              <h3>{t('inRevit')}</h3>
              <ul>
                {usedCommands.map((c) => (
                  <li key={c.id}>
                    <RibbonIcon id={c.id} />
                    <span className="bq-cmp-path">{c.path}</span>
                    {c.shortcut && (
                      <span className="bq-cmp-kbd">
                        {t('shortcut')} <kbd>{c.shortcut}</kbd>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="bq-cmp-bridge">{tx(level.bridge, L)}</p>
            </section>
            <div className="bq-cmp-done-actions">
              <button type="button" className="bq-cmp-icon-btn" onClick={onReplay} data-testid="campaign-replay">
                {t('replay')}
              </button>
              <button type="button" className="bq-cmp-primary" onClick={onNext} data-testid="campaign-next">
                {!isLast ? t('next') : t('seeHouse')} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AnimatedStars: React.FC<{ n: number; reducedMotion: boolean }> = ({ n, reducedMotion }) => {
  const [shown, setShown] = useState(reducedMotion ? n : 0);
  useEffect(() => {
    if (shown >= n) return;
    const id = window.setTimeout(() => {
      setShown((s) => s + 1);
      playSound('star');
    }, 280);
    return () => window.clearTimeout(id);
  }, [shown, n]);
  return (
    <div className="bq-cmp-big-stars" data-testid="campaign-stars" data-stars={n}>
      <Stars n={shown} />
      <small>{t('starsInfo')}</small>
    </div>
  );
};

// ---------------------------------------------------------------------------
// House complete
// ---------------------------------------------------------------------------

const HouseComplete: React.FC<{ house: HouseDef; progress: CampaignProgress; theme: 'light' | 'dark'; onBack: () => void }> = ({
  house,
  progress,
  theme,
  onBack,
}) => {
  const model = useMemo(() => startModelFor(house, house.levels.length), [house]);
  const used = useMemo(
    () => RIBBON.filter((c) => house.levels.some((l) => l.steps.some((st) => st.command === c.id))),
    [house]
  );
  useEffect(() => playSound('success'), []);
  return (
    <div className="bq-cmp-house-done" data-testid="campaign-house-done">
      <div className="bq-cmp-house-3d">
        <Suspense fallback={null}>
          <SceneViewport
            task={CAMPAIGN_TASK}
            model={model}
            selectedId={null}
            failedElementIds={EMPTY_FAILED}
            reducedMotion={false}
            isVisible
            theme={theme}
            onSelect={() => undefined}
            minimal
          />
        </Suspense>
      </div>
      <div className="bq-cmp-house-text">
        <h1>{tx(house.title, L)}: {t('houseDone')}</h1>
        <p className="bq-cmp-hub-total">★ {houseStars(house, progress)} / {house.levels.length * 3}</p>
        <p>{t('houseDoneSub')}</p>
        <ul className="bq-cmp-cmd-list">
          {used.map((c) => (
            <li key={c.id}>
              <RibbonIcon id={c.id} />
              <span className="bq-cmp-path">{c.path}</span>
              {c.shortcut && <kbd>{c.shortcut}</kbd>}
            </li>
          ))}
        </ul>
        <button type="button" className="bq-cmp-primary" onClick={onBack} data-testid="campaign-house-back">
          {t('backToHub')}
        </button>
      </div>
    </div>
  );
};
