import React, { useRef } from 'react';
import { FINAL_CRITERION_NOTES } from '../../content/finalProject';
import { calculateMissionXp, calculateTotalPlayerXp } from '../../domain/pedagogy';
import type { SheetElement, SubmittedEvaluation, MissionTask, BimModel } from '../../domain/types';
import { SheetSvg, downloadSvgAsPng } from '../../plan/SheetSvg';
import { badgeLabelTr } from './format';

interface ProjectDeliveryProps {
  open: boolean;
  evaluation: SubmittedEvaluation | null;
  task: MissionTask;
  model: BimModel;
  completedMap: Record<string, { bestScore: number }>;
  onClose: () => void;
  onBackToDashboard: () => void;
}

/** "Proje Teslimi": the last screen of the final project. */
export const ProjectDelivery: React.FC<ProjectDeliveryProps> = ({
  open,
  evaluation,
  task,
  model,
  completedMap,
  onClose,
  onBackToDashboard,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  if (!open || !evaluation || !evaluation.pass || evaluation.stale) return null;
  const sheet = model.elements.find((e): e is SheetElement => e.type === 'sheet');
  const player = calculateTotalPlayerXp(completedMap);
  const passed = evaluation.criteria.filter((c) => c.pass).length;
  return (
    <div
      className="bq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-title"
      data-testid="project-delivery-modal"
    >
      <div className="bq-modal-card bq-recap-card bq-delivery-card">
        <div className="bq-recap-header">
          <span className="bq-recap-kicker">PROJE TESLİMİ — {task.title.toUpperCase()}</span>
          <h2 id="delivery-title">Tek Katlı Konut — Teslim Edildi</h2>
        </div>

        <div className="bq-recap-score-row">
          <div className="bq-recap-score-box">
            <span className="bq-recap-score-val" data-testid="delivery-score">{evaluation.score}</span>
            <span className="bq-recap-score-lbl">Puan</span>
          </div>
          <div className="bq-recap-score-box">
            <span className="bq-recap-score-val">+{calculateMissionXp(evaluation.score)} XP</span>
            <span className="bq-recap-score-lbl">Bu teslim</span>
          </div>
          <div className="bq-recap-score-box">
            <span className="bq-recap-score-val" data-testid="delivery-total-xp">{player.totalXp} XP</span>
            <span className="bq-recap-score-lbl">Toplam · {player.rankTitle}</span>
          </div>
          <div className="bq-recap-badge-box">
            <span className={`bq-badge bq-badge-${evaluation.badge}`} data-testid="delivery-badge">
              {badgeLabelTr(evaluation.badge)}
            </span>
          </div>
        </div>

        {sheet && (
          <div ref={sheetRef} className="bq-delivery-sheet" data-testid="delivery-sheet">
            <SheetSvg model={model} sheet={sheet} />
          </div>
        )}

        <h3>
          Brif Kriterleri ({passed}/{evaluation.criteria.length})
        </h3>
        <table className="bq-delivery-table" data-testid="delivery-criteria-table">
          <tbody>
            {evaluation.criteria.map((c) => (
              <tr key={c.id} data-testid={`delivery-row-${c.id}`}>
                <td>{c.pass ? '✓' : '✕'}</td>
                <td>{c.message}</td>
                <td>
                  <code>{FINAL_CRITERION_NOTES[c.id] ?? '—'}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="bq-modal-actions">
          {sheet && (
            <button
              type="button"
              className="bq-btn bq-btn-secondary"
              data-testid="delivery-export-btn"
              onClick={() => {
                const svg = sheetRef.current?.querySelector('svg');
                if (svg) void downloadSvgAsPng(svg as SVGSVGElement, `${sheet.number}-${sheet.name}.png`);
              }}
            >
              Paftayı PNG kaydet
            </button>
          )}
          <button type="button" className="bq-btn bq-btn-secondary" data-testid="delivery-close-btn" onClick={onClose}>
            Modeli İncelemeye Dön
          </button>
          <button type="button" className="bq-btn bq-btn-primary" data-testid="delivery-dashboard-btn" onClick={onBackToDashboard}>
            Öğrenme Yoluna Dön
          </button>
        </div>
      </div>
    </div>
  );
};
