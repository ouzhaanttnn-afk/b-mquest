import { describe, expect, it } from 'vitest';
import { loadValidatedCatalog } from '../src/content/content';
import { createInitialSession } from '../src/domain/commands';
import { evaluate } from '../src/domain/evaluator';
import { explainCriterionFailureTr } from '../src/domain/pedagogy';

describe('Kontrol et açıklamaları hiçbir görevde çökmez', () => {
  const cat = loadValidatedCatalog();
  if (!cat.ok) throw new Error('catalog');
  it('her görevin başlangıç modelinde her kriterin açıklaması üretilebilir', () => {
    for (const task of cat.catalog.missions) {
      const s = createInitialSession(task);
      const ev = evaluate(task, s.model, 0);
      for (const c of ev.criteria) {
        for (const hints of [0, 1, 2, 3]) {
          expect(() => explainCriterionFailureTr(task, s.model, c, hints), `${task.id}/${c.id}`).not.toThrow();
        }
      }
    }
  });
});
