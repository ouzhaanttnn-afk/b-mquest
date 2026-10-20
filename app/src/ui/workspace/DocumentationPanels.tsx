import React, { useRef, useState } from 'react';
import {
  createSheetCommand,
  createViewCommand,
  placeOnSheetCommand,
  removeFromSheetCommand,
  updateElementProperty,
  type CommandResult,
  type MissionSessionState,
} from '../../domain/commands';
import { viewPaperSize } from '../../domain/documentation';
import type { SheetElement, ViewElement } from '../../domain/types';
import { buildViewDrawing } from '../../domain/viewDrawing';
import { DrawingSvg } from '../../plan/DrawingSvg';
import { SheetSvg, downloadSvgAsPng } from '../../plan/SheetSvg';

interface BaseProps {
  session: MissionSessionState;
  applyResult: (res: CommandResult) => void;
}

const viewsOf = (s: MissionSessionState) =>
  s.model.elements.filter((e): e is ViewElement => e.type === 'view');
const sheetsOf = (s: MissionSessionState) =>
  s.model.elements.filter((e): e is SheetElement => e.type === 'sheet');

/** Project Browser: Views and Sheets. */
export const ProjectBrowser: React.FC<
  BaseProps & {
    open: boolean;
    activeViewId: string | null;
    setActiveViewId: (id: string | null) => void;
    onOpenSheet: (id: string) => void;
    onClose: () => void;
  }
> = ({ open, session, applyResult, activeViewId, setActiveViewId, onOpenSheet, onClose }) => {
  if (!open) return null;
  const perms = session.task.permissions.creatableTypes;
  const views = viewsOf(session);
  const group = (title: string, items: ViewElement[]) =>
    items.length > 0 && (
      <section>
        <h3>{title}</h3>
        <ul className="bq-object-items">
          {items.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                className={`bq-object-row ${activeViewId === v.id ? 'selected' : ''}`}
                data-testid={`view-open-${v.id}`}
                onClick={() => {
                  setActiveViewId(v.id);
                  onClose();
                }}
              >
                <span className="bq-obj-id">{v.id}</span>
                <span className="bq-obj-type">{v.name}</span>
                <span className="bq-obj-meta">1:{v.scale}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <div
      className="bq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Proje Tarayıcısı"
      data-testid="project-browser"
      onClick={onClose}
    >
      <div className="bq-modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Proje Tarayıcısı</h2>
        <button
          type="button"
          className={`bq-chip-btn ${activeViewId === null ? 'active' : ''}`}
          data-testid="view-open-working"
          onClick={() => {
            setActiveViewId(null);
            onClose();
          }}
        >
          Çalışma planı
        </button>
        {group('Planlar', views.filter((v) => v.kind === 'plan'))}
        {group('Kesitler', views.filter((v) => v.kind === 'section'))}
        {group('Cepheler', views.filter((v) => v.kind === 'elevation'))}
        {perms.includes('view') && (
          <div className="bq-quick-steppers-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {session.model.levels.map((l) => (
              <button
                key={l.id}
                type="button"
                className="bq-chip-btn"
                data-testid={`add-plan-${l.id}`}
                onClick={() => applyResult(createViewCommand(session, { kind: 'plan', levelId: l.id }))}
              >
                ＋ Plan · {l.name}
              </button>
            ))}
          </div>
        )}
        <section>
          <h3>Paftalar</h3>
          <ul className="bq-object-items">
            {sheetsOf(session).map((sh) => (
              <li key={sh.id}>
                <button
                  type="button"
                  className="bq-object-row"
                  data-testid={`sheet-open-${sh.id}`}
                  onClick={() => {
                    onOpenSheet(sh.id);
                    onClose();
                  }}
                >
                  <span className="bq-obj-id">{sh.number}</span>
                  <span className="bq-obj-type">{sh.name}</span>
                  <span className="bq-obj-meta">{sh.placements.length} görünüm</span>
                </button>
              </li>
            ))}
          </ul>
          {perms.includes('sheet') && (
            <button
              type="button"
              className="bq-chip-btn"
              data-testid="add-sheet-btn"
              onClick={() => applyResult(createSheetCommand(session))}
            >
              ＋ Pafta Ekle
            </button>
          )}
        </section>
        <div className="bq-modal-actions">
          <button type="button" className="bq-btn bq-btn-primary" data-testid="close-project-browser-btn" onClick={onClose}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};

/** Sheet editor: A3 sheet with draggable views, title block and PNG export. */
export const SheetEditor: React.FC<
  BaseProps & {
    sheetId: string | null;
    setSheetId: (id: string | null) => void;
  }
> = ({ session, applyResult, sheetId, setSheetId }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<{ name?: string; number?: string }>({});
  const sheet = sheetId
    ? session.model.elements.find((e): e is SheetElement => e.id === sheetId && e.type === 'sheet')
    : undefined;
  if (!sheetId || !sheet) return null;
  const fields = session.task.permissions.editableFields as string[];
  const views = viewsOf(session);
  const canPlace = fields.includes('placements');
  const commit = (field: 'name' | 'number', value: string | undefined) => {
    if (value === undefined) return;
    applyResult(updateElementProperty(session, sheet.id, field, value));
    setDraft((d) => ({ ...d, [field]: undefined }));
  };
  return (
    <div
      className="bq-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Pafta düzenleyici"
      data-testid="sheet-editor"
      onClick={() => setSheetId(null)}
    >
      <div className="bq-modal-card bq-sheet-card" onClick={(e) => e.stopPropagation()}>
        <h2>
          {sheet.number} · {sheet.name}
        </h2>
        <div className="bq-sheet-fields">
          <label className="bq-field">
            <span>Pafta No</span>
            <input
              type="text"
              data-testid="sheet-number-input"
              value={draft.number ?? sheet.number}
              disabled={!fields.includes('number')}
              onChange={(e) => setDraft({ ...draft, number: e.target.value })}
              onBlur={() => commit('number', draft.number)}
            />
          </label>
          <label className="bq-field">
            <span>Pafta Adı</span>
            <input
              type="text"
              data-testid="sheet-name-input"
              value={draft.name ?? sheet.name}
              disabled={!fields.includes('name')}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              onBlur={() => commit('name', draft.name)}
            />
          </label>
        </div>

        <div ref={wrapRef} className="bq-sheet-wrap">
          <SheetSvg
            model={session.model}
            sheet={sheet}
            onMovePlacement={
              canPlace
                ? (viewId, x, z) => applyResult(placeOnSheetCommand(session, sheet.id, viewId, x, z))
                : undefined
            }
          />
        </div>

        <ul className="bq-object-items" data-testid="sheet-view-list">
          {views.map((v) => {
            const placed = sheet.placements.some((p) => p.viewId === v.id);
            const size = viewPaperSize(v, session.model);
            return (
              <li key={v.id}>
                <div className="bq-object-row">
                  <span className="bq-obj-id">{v.id}</span>
                  <span className="bq-obj-type">
                    {v.name} · 1:{v.scale}
                  </span>
                  <span className="bq-obj-meta">
                    {Math.round(size.w)}×{Math.round(size.h)} mm
                  </span>
                  {placed ? (
                    <button
                      type="button"
                      className="bq-chip-btn"
                      data-testid={`remove-view-${v.id}`}
                      disabled={!canPlace}
                      onClick={() => applyResult(removeFromSheetCommand(session, sheet.id, v.id))}
                    >
                      Kaldır
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="bq-chip-btn bq-chip-accent"
                      data-testid={`place-view-${v.id}`}
                      disabled={!canPlace}
                      onClick={() => applyResult(placeOnSheetCommand(session, sheet.id, v.id))}
                    >
                      Yerleştir
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="bq-modal-actions">
          <button
            type="button"
            className="bq-btn bq-btn-secondary"
            data-testid="export-sheet-png-btn"
            onClick={() => {
              const svg = wrapRef.current?.querySelector('svg');
              if (svg) void downloadSvgAsPng(svg as SVGSVGElement, `${sheet.number}-${sheet.name}.png`);
            }}
          >
            PNG olarak kaydet
          </button>
          <button type="button" className="bq-btn bq-btn-primary" data-testid="close-sheet-editor-btn" onClick={() => setSheetId(null)}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};

/** Section / elevation drawing generated from the live model. */
export const ViewPane: React.FC<{
  session: MissionSessionState;
  view: ViewElement;
  isDark: boolean;
  onBack: () => void;
}> = ({ session, view, isDark, onBack }) => {
  const drawing = buildViewDrawing(session.model, view);
  return (
    <div className="bq-plan-container" data-testid="view-pane">
      <div className="bq-viewport-toolbar bq-toolbar-2d">
        <span className="bq-viewport-badge bq-badge-2d" data-testid="view-pane-title">
          {view.kind === 'section' ? '✂' : '🏛'} {view.name} · 1:{view.scale}
        </span>
        <div className="bq-viewport-controls">
          <button type="button" className="bq-chip-btn" data-testid="view-back-btn" onClick={onBack}>
            Plana dön
          </button>
        </div>
      </div>
      <DrawingSvg drawing={drawing} isDark={isDark} testId="view-drawing" title={view.name} />
    </div>
  );
};
