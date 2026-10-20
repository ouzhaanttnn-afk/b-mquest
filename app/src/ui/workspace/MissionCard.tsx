import React, { useState } from 'react';
import type { CriterionEvidence } from '../../domain/types';

interface MissionCardProps {
  objective: string;
  criteria: CriterionEvidence[];
}

/**
 * Phone-first mission card: one sentence of goal and a tap-to-open checklist
 * that ticks off live, so "what do I have to do?" is always on screen.
 */
export const MissionCard: React.FC<MissionCardProps> = ({ objective, criteria }) => {
  const [open, setOpen] = useState(false);
  const done = criteria.filter((c) => c.pass).length;
  return (
    <section className="bq-mission-card bq-mobile-only" data-testid="mission-card">
      <p className="bq-mission-goal">
        <strong>🎯 Görev:</strong> {objective}
      </p>
      <button
        type="button"
        className="bq-chip-btn"
        data-testid="mission-card-rules-btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Yapılacaklar {done}/{criteria.length} {open ? '▴' : '▾'}
      </button>
      {open && (
        <ul className="bq-mission-checklist" data-testid="mission-card-list">
          {criteria.map((c) => (
            <li key={c.id} className={c.pass ? 'done' : ''}>
              <span aria-hidden="true">{c.pass ? '✅' : '⬜'}</span> {c.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
