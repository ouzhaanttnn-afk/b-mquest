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
  const [more, setMore] = useState(false);
  const [full, setFull] = useState(false);
  // First sentence is the goal; the rest is detail behind a tap.
  const cut = objective.search(/[.!?](\s|$)/);
  const goal = cut > 0 && cut < objective.length - 1 ? objective.slice(0, cut + 1) : objective;
  const detail = objective.slice(goal.length).trim();
  const done = criteria.filter((c) => c.pass).length;
  return (
    <section className="bq-mission-card bq-mobile-only" data-testid="mission-card">
      <p
        className={`bq-mission-goal ${full ? 'expanded' : ''}`}
        data-testid="mission-card-goal"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          setFull((v) => !v);
        }}
      >
        <strong>🎯 Görev:</strong> {goal}{' '}
        {detail && (
          <button type="button" className="bq-link-btn" data-testid="mission-card-more-btn" aria-expanded={more} onClick={() => setMore((v) => !v)}>
            {more ? 'Gizle' : '?'}
          </button>
        )}
      </p>
      {more && detail && (
        <p className="bq-mission-detail" data-testid="mission-card-detail">
          {detail}
        </p>
      )}
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
