import React, { useEffect, useState } from 'react';
import type { CriterionEvidence, MissionTask } from '../../domain/types';
import type { ToolId } from './toolActions';
import { TOOL_DEFS } from './toolActions';

const COACH_MISSIONS = ['m01', 'm02', 'm03'];
const OFF_KEY = 'bimquest.coach.off';

export interface CoachStep {
  text: string;
  /** data-testid of the button to pulse. */
  pulse?: string;
  /** Element ids to pulse on the plan. */
  planTargets: string[];
  /** Offer a shortcut that opens the property sheet. */
  openInspector?: boolean;
}

/**
 * One next step for the first three missions: teaches the gestures
 * (select, edit, draw, place, check) without scripting the answer values.
 */
export function coachStep(args: {
  task: MissionTask;
  criteria: CriterionEvidence[];
  selectedId: string | null;
  activeTool: ToolId;
  allPass: boolean;
}): CoachStep {
  const { task, criteria, selectedId, activeTool, allPass } = args;
  if (allPass) {
    return { text: 'Hepsi tamam! Şimdi “Kontrol et”e bas.', pulse: 'check-btn', planTargets: [] };
  }

  const failing = criteria.filter((c) => !c.pass);
  const creatable = task.permissions.creatableTypes;

  // Missions that ask the player to draw or place something.
  if (creatable.length > 0) {
    const wantTool = creatable.find((t) => TOOL_DEFS.some((d) => d.id === t)) as ToolId | undefined;
    if (wantTool && activeTool === 'select') {
      const label = TOOL_DEFS.find((d) => d.id === wantTool)?.label ?? wantTool;
      return { text: `Önce üstten “${label}” aracını seç.`, pulse: `tool-${wantTool}-btn`, planTargets: [] };
    }
    if (wantTool && activeTool === wantTool) {
      const hint = TOOL_DEFS.find((d) => d.id === wantTool)?.hint ?? '';
      return { text: hint, planTargets: [] };
    }
    // Created, but something is still off: fall through to editing.
  }

  const propertyTargets = failing
    .map((c) => task.criteria.find((tc) => tc.id === c.id))
    .flatMap((tc) => (tc && tc.type === 'property' ? [tc.elementId] : []));
  const targets = [...new Set(propertyTargets)];
  if (targets.length > 0) {
    if (!selectedId || !targets.includes(selectedId)) {
      return {
        text: `Parlayan nesneye dokun (${targets.slice(0, 3).join(', ')}).`,
        planTargets: targets,
      };
    }
    return {
      text: 'Seçtin! Şimdi hedefe uymayan değeri düzelt.',
      planTargets: [],
      openInspector: true,
    };
  }
  return { text: 'Hedefe bak: eksik olan maddeyi tamamla.', planTargets: [] };
}

interface CoachBarProps {
  task: MissionTask;
  step: CoachStep;
  onOpenInspector: () => void;
}

export const CoachBar: React.FC<CoachBarProps> = ({ task, step, onOpenInspector }) => {
  const [off, setOff] = useState(() => {
    try {
      return window.localStorage.getItem(OFF_KEY) === '1';
    } catch {
      return false;
    }
  });
  const active = COACH_MISSIONS.includes(task.id) && !off;

  useEffect(() => {
    if (!active || !step.pulse) return;
    const el = document.querySelector(`[data-testid="${step.pulse}"]`);
    el?.classList.add('bq-coach-pulse');
    return () => el?.classList.remove('bq-coach-pulse');
  }, [active, step.pulse]);

  if (!active) return null;
  return (
    <div className="bq-coach-bar" data-testid="coach-bar" role="status">
      <span className="bq-coach-icon" aria-hidden="true">👉</span>
      <span className="bq-coach-text" data-testid="coach-text">
        {step.text}
      </span>
      {step.openInspector && (
        <button type="button" className="bq-chip-btn bq-chip-accent" data-testid="coach-open-inspector" onClick={onOpenInspector}>
          Özellikleri aç
        </button>
      )}
      <button
        type="button"
        className="bq-chip-btn"
        data-testid="coach-off-btn"
        onClick={() => {
          setOff(true);
          try {
            window.localStorage.setItem(OFF_KEY, '1');
          } catch {
            /* private mode: fine, it just shows again next time */
          }
        }}
      >
        Kapat
      </button>
    </div>
  );
};
