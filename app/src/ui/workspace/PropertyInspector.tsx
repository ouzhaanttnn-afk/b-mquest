import React from 'react';
import type { ToolId } from './toolActions';
import type { CommandResult, MissionSessionState } from '../../domain/commands';
import {
  CreateExtraPanel,
  GenericElementForm,
  LevelsPanel,
  TypePanel,
  WallRelationFields,
} from './ExtendedPanels';
import { elementLabelTr, elementMetaTr } from './elementLabels';
import type { WallElement } from '../../domain/types';
import type { LearningConceptInfo } from '../../domain/pedagogy';
import type { MissionTask, BimModel, BimElement, EditableField } from '../../domain/types';
import { WALL_QUICK_PRESETS } from './format';
import { getWallLengthMm } from '../../plan/geometry';
import { MmStepperField } from '../MmStepperField';
import { type DoorElement } from '../../domain/types';

export interface PropertyInspectorProps {
  rightCollapsed: boolean;
  mobileDrawerTab: "brief" | "inspector" | "check";
  mobileSheetOpen: boolean;
  selectedElement: BimElement | null;
  setMobileSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRightCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  fieldError: string | null;
  activeTool: ToolId;
  task: MissionTask;
  session: MissionSessionState;
  applyResult: (res: CommandResult) => void;
  handleCreateWallSubmit: (e: React.FormEvent) => void;
  setActiveTool: React.Dispatch<React.SetStateAction<ToolId>>;
  setWallForm: React.Dispatch<React.SetStateAction<{ name: string; baseLevelId: string; startX: string; startZ: string; endX: string; endZ: string; height: string; thickness: string; }>>;
  wallForm: { name: string; baseLevelId: string; startX: string; startZ: string; endX: string; endZ: string; height: string; thickness: string; };
  model: BimModel;
  handleCreateDoorSubmit: (e: React.FormEvent) => void;
  doorForm: { name: string; hostWallId: string; offset: string; width: string; height: string; sill: string; mark: string; fireRating: string; };
  setDoorForm: React.Dispatch<React.SetStateAction<{ name: string; hostWallId: string; offset: string; width: string; height: string; sill: string; mark: string; fireRating: string; }>>;
  wallsInModel: WallElement[];
  selectedId: string | null;
  handleSelectElement: (id: string | null) => void;
  failedElementIds: Set<string>;
  canDeleteSelected: boolean;
  handleDeleteSelected: () => void;
  learningGuide: LearningConceptInfo;
  isFieldEditable: (field: EditableField) => boolean;
  editDrafts: Record<string, string>;
  setEditDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  commitSingleField: (field: EditableField, rawValue: unknown) => void;
  numericProp: (field: string) => number;
  handleFieldKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, fieldKey: string, onCommit: () => void) => void;
  commitCoordPair: (which: "start" | "end") => void;
  handleMoveSelectedWall: (dxRaw: string | number, dzRaw: string | number) => void;
  moveDelta: { dx: string; dz: string; };
  setMoveDelta: React.Dispatch<React.SetStateAction<{ dx: string; dz: string; }>>;
}

export const PropertyInspector: React.FC<PropertyInspectorProps> = ({
  rightCollapsed,
  mobileDrawerTab,
  mobileSheetOpen,
  selectedElement,
  setMobileSheetOpen,
  setRightCollapsed,
  fieldError,
  activeTool,
  task,
  session,
  applyResult,
  handleCreateWallSubmit,
  setActiveTool,
  setWallForm,
  wallForm,
  model,
  handleCreateDoorSubmit,
  doorForm,
  setDoorForm,
  wallsInModel,
  selectedId,
  handleSelectElement,
  failedElementIds,
  canDeleteSelected,
  handleDeleteSelected,
  learningGuide,
  isFieldEditable,
  editDrafts,
  setEditDrafts,
  commitSingleField,
  numericProp,
  handleFieldKeyDown,
  commitCoordPair,
  handleMoveSelectedWall,
  moveDelta,
  setMoveDelta,
}) => (
  <>
        <aside
          className={`bq-panel bq-panel-right ${
            rightCollapsed ? 'collapsed' : ''
          } ${mobileDrawerTab === 'inspector' ? 'mobile-active' : ''} ${
            mobileDrawerTab === 'inspector' && mobileSheetOpen ? 'sheet-open' : ''
          }`}
          data-testid="right-inspector-panel"
          aria-label="Nesne Listesi ve Özellik Düzenleyici"
        >
          <div className="bq-panel-header">
            <h2>
              Nesneler & Özellikler
              {selectedElement ? ` · ${selectedElement.id}` : ''}
            </h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="bq-chip-btn bq-mobile-close-sheet-btn"
                data-testid="close-mobile-sheet-btn"
                onClick={() => setMobileSheetOpen(false)}
              >
                ✕ Sahneyi Gör
              </button>
              <button
                type="button"
                className="bq-chip-btn bq-desktop-collapse-btn"
                onClick={() => setRightCollapsed((v) => !v)}
                aria-expanded={!rightCollapsed}
                data-testid="toggle-right-panel-btn"
              >
                {rightCollapsed ? '« Göster' : 'Daralt »'}
              </button>
            </div>
          </div>

          {!rightCollapsed && (
            <div className="bq-panel-scroll">
              {/* Field / Command Validation Error Banner */}
              {fieldError && (
                <div
                  className="bq-field-error"
                  role="alert"
                  data-testid="field-error-alert"
                >
                  <strong>Hata:</strong> {fieldError}
                </div>
              )}

              {/* CREATE WALL FORM (when activeTool === 'wall') */}
              {activeTool === 'wall' &&
                task.permissions.creatableTypes.includes('wall') && (
                  <form
                    className="bq-tool-form"
                    data-testid="create-wall-form"
                    onSubmit={handleCreateWallSubmit}
                  >
                    <div className="bq-form-title-row">
                      <h3>Yeni Duvar Oluştur (mm)</h3>
                      <button
                        type="button"
                        className="bq-chip-btn"
                        onClick={() => setActiveTool('select')}
                      >
                        Kapat (Esc)
                      </button>
                    </div>

                    {/* Quick Room Edge Presets for Touch / Fast Testing */}
                    <div className="bq-presets-box">
                      <span className="bq-presets-label">
                        Hızlı Kenar Şablonları (veya aşağıdan elle girin):
                      </span>
                      <div className="bq-presets-grid">
                        {WALL_QUICK_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            className="bq-chip-btn"
                            data-testid={`preset-${preset.name}`}
                            onClick={() =>
                              setWallForm((prev) => ({
                                ...prev,
                                name: preset.name,
                                startX: preset.startX,
                                startZ: preset.startZ,
                                endX: preset.endX,
                                endZ: preset.endZ,
                              }))
                            }
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>Başlangıç X (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="wall-start-x"
                          value={wallForm.startX}
                          onChange={(e) =>
                            setWallForm({ ...wallForm, startX: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Başlangıç Z (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="wall-start-z"
                          value={wallForm.startZ}
                          onChange={(e) =>
                            setWallForm({ ...wallForm, startZ: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Bitiş X (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="wall-end-x"
                          value={wallForm.endX}
                          onChange={(e) =>
                            setWallForm({ ...wallForm, endX: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Bitiş Z (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="wall-end-z"
                          value={wallForm.endZ}
                          onChange={(e) =>
                            setWallForm({ ...wallForm, endZ: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Yükseklik (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="wall-height"
                          value={wallForm.height}
                          onChange={(e) =>
                            setWallForm({ ...wallForm, height: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Kalınlık (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="wall-thickness"
                          value={wallForm.thickness}
                          onChange={(e) =>
                            setWallForm({
                              ...wallForm,
                              thickness: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>

                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>Kat Referansı</span>
                        <select
                          data-testid="wall-level"
                          value={wallForm.baseLevelId}
                          onChange={(e) =>
                            setWallForm({
                              ...wallForm,
                              baseLevelId: e.target.value,
                            })
                          }
                        >
                          {model.levels.map((lvl) => (
                            <option key={lvl.id} value={lvl.id}>
                              {lvl.name} ({lvl.id} · {lvl.elevation} mm)
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="bq-field">
                        <span>Duvar Adı</span>
                        <input
                          type="text"
                          data-testid="wall-name"
                          value={wallForm.name}
                          onChange={(e) =>
                            setWallForm({ ...wallForm, name: e.target.value })
                          }
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="bq-btn bq-btn-primary bq-btn-full"
                      data-testid="confirm-create-wall-btn"
                    >
                      Duvarı Onayla ve Oluştur
                    </button>
                  </form>
                )}

              {/* CREATE DOOR FORM (when activeTool === 'door') */}
              {activeTool === 'door' &&
                task.permissions.creatableTypes.includes('door') && (
                  <form
                    className="bq-tool-form"
                    data-testid="create-door-form"
                    onSubmit={handleCreateDoorSubmit}
                  >
                    <div className="bq-form-title-row">
                      <h3>Yeni Kapı Oluştur (Bağlı Açıklık)</h3>
                      <button
                        type="button"
                        className="bq-chip-btn"
                        onClick={() => setActiveTool('select')}
                      >
                        Kapat (Esc)
                      </button>
                    </div>

                    <label className="bq-field">
                      <span>Taşıyıcı Duvar (Host Wall)</span>
                      <select
                        data-testid="door-host-wall"
                        value={doorForm.hostWallId}
                        onChange={(e) =>
                          setDoorForm({
                            ...doorForm,
                            hostWallId: e.target.value,
                          })
                        }
                      >
                        {wallsInModel.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.id} ({w.name} · Uzunluk: {getWallLengthMm(w)} mm)
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>Başlangıçtan Ofset (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="door-offset"
                          value={doorForm.offset}
                          onChange={(e) =>
                            setDoorForm({ ...doorForm, offset: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Genişlik (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="door-width"
                          value={doorForm.width}
                          onChange={(e) =>
                            setDoorForm({ ...doorForm, width: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Yükseklik (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="door-height"
                          value={doorForm.height}
                          onChange={(e) =>
                            setDoorForm({ ...doorForm, height: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Eşik / Sill (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="door-sill"
                          value={doorForm.sill}
                          onChange={(e) =>
                            setDoorForm({ ...doorForm, sill: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Kapı İşareti (Mark)</span>
                        <input
                          type="text"
                          data-testid="door-mark"
                          value={doorForm.mark}
                          onChange={(e) =>
                            setDoorForm({ ...doorForm, mark: e.target.value })
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Yangın Sınıfı (Fire Rating)</span>
                        <select
                          data-testid="door-fire-rating"
                          value={doorForm.fireRating}
                          onChange={(e) =>
                            setDoorForm({
                              ...doorForm,
                              fireRating: e.target.value,
                            })
                          }
                        >
                          <option value="none">none (Standart / Sınıf Yok)</option>
                          <option value="EI30">EI30</option>
                          <option value="EI60">EI60</option>
                        </select>
                      </label>
                    </div>

                    <label className="bq-field">
                      <span>Kapı Adı</span>
                      <input
                        type="text"
                        data-testid="door-name"
                        value={doorForm.name}
                        onChange={(e) =>
                          setDoorForm({ ...doorForm, name: e.target.value })
                        }
                      />
                    </label>

                    <button
                      type="submit"
                      className="bq-btn bq-btn-primary bq-btn-full"
                      data-testid="confirm-create-door-btn"
                    >
                      Kapıyı Onayla ve Oluştur
                    </button>
                  </form>
                )}

              <CreateExtraPanel model={model} session={session} applyResult={applyResult} />
              {task.permissions.editableFields.includes('elevation') && (
                <LevelsPanel model={model} session={session} applyResult={applyResult} />
              )}

              {/* DOM OBJECT LIST (Keyboard-Operable Selection Alternative) */}
              <div
                className="bq-object-list-section"
                data-tour="object-list"
                data-testid="object-list"
              >
                <div className="bq-section-subheader">
                  <h3>Model Nesneleri ({model.elements.length})</h3>
                  {selectedId && (
                    <button
                      type="button"
                      className="bq-chip-btn"
                      onClick={() => handleSelectElement(null)}
                    >
                      Seçimi Temizle
                    </button>
                  )}
                </div>

                {model.elements.length === 0 ? (
                  <div className="bq-empty-list" data-testid="empty-object-list">
                    <img
                      src="./assets/illustrations/empty-state.svg"
                      alt=""
                      aria-hidden="true"
                      width={160}
                      height={94}
                    />
                    <p>Henüz modelde nesne yok.</p>
                    {task.permissions.creatableTypes.includes('wall') && (
                      <button
                        type="button"
                        className="bq-btn bq-btn-primary bq-btn-compact"
                        onClick={() => setActiveTool('wall')}
                      >
                        + İlk Duvarı Oluştur
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="bq-object-items" role="listbox" aria-label="Modeldeki Yapı Nesneleri">
                    {model.elements.map((el) => {
                      const isSel = el.id === selectedId;
                      const isFail = failedElementIds.has(el.id);
                      return (
                        <li key={el.id} role="option" aria-selected={isSel}>
                          <button
                            type="button"
                            className={`bq-object-row ${
                              isSel ? 'selected' : ''
                            } ${isFail ? 'failed' : ''}`}
                            data-testid={`object-row-${el.id}`}
                            onClick={() => handleSelectElement(el.id)}
                          >
                            <span className="bq-obj-id">
                              {isFail ? '! ' : isSel ? '✓ ' : ''}
                              {el.id}
                            </span>
                            <span className="bq-obj-type">
                              {elementLabelTr(el)}
                            </span>
                            <span className="bq-obj-meta">
                              {elementMetaTr(el)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* SELECTED ELEMENT PROPERTY INSPECTOR */}
              <div
                className="bq-property-inspector"
                data-tour="property-editor"
                data-testid="property-inspector"
              >
                <div className="bq-section-subheader">
                  <h3>Seçili Nesne Özellikleri</h3>
                  {canDeleteSelected && (
                    <button
                      type="button"
                      className="bq-btn bq-btn-danger bq-btn-compact"
                      data-testid="delete-selected-btn"
                      onClick={handleDeleteSelected}
                    >
                      Nesneyi Sil ({selectedElement?.id})
                    </button>
                  )}
                </div>

                {!selectedElement ? (
                  <p className="bq-muted-note" data-testid="no-selection-note">
                    Özelliklerini incelemek veya düzenlemek için 2B Plandan, 3B
                    Sahneden ya da yukarıdaki Nesne Listesinden bir öğe seçin.
                  </p>
                ) : selectedElement.type === 'wall' ? (
                  <div
                    className="bq-prop-form"
                    data-testid={`prop-form-${selectedElement.id}`}
                  >
                    <div className="bq-revit-type-selector">
                      <span className="bq-revit-family-lbl">Basic Wall</span>
                      <strong>
                        Generic - {selectedElement.thickness}mm ·{' '}
                        <span data-testid="selected-element-id">
                          {selectedElement.id} (Duvar)
                        </span>
                      </strong>
                    </div>

                    <WallRelationFields
                      wall={selectedElement}
                      model={model}
                      selectedElement={selectedElement}
                      editDrafts={editDrafts}
                      setEditDrafts={setEditDrafts}
                      isFieldEditable={isFieldEditable}
                      commitSingleField={commitSingleField}
                      handleFieldKeyDown={handleFieldKeyDown}
                    />
                    <TypePanel
                      model={model}
                      selectedElement={selectedElement}
                      session={session}
                      canEditType={task.permissions.editableFields.includes('typeParams')}
                      applyResult={applyResult}
                    />

                    {/* Base Constraint (Level) */}
                    <label
                      className={`bq-field ${
                        learningGuide.primaryFields.includes('baseLevelId')
                          ? 'bq-field-primary'
                          : ''
                      }`}
                    >
                      <span>
                        Base Constraint / Kat ({selectedElement.baseLevelId})
                        {learningGuide.primaryFields.includes('baseLevelId') && (
                          <em className="bq-primary-field-tag">★ Aktif Parametre</em>
                        )}
                      </span>
                      <select
                        data-testid="prop-input-baseLevelId"
                        disabled={!isFieldEditable('baseLevelId')}
                        value={
                          editDrafts.baseLevelId ?? selectedElement.baseLevelId
                        }
                        onChange={(e) => {
                          setEditDrafts({
                            ...editDrafts,
                            baseLevelId: e.target.value,
                          });
                          commitSingleField('baseLevelId', e.target.value);
                        }}
                      >
                        {model.levels.map((lvl) => (
                          <option key={lvl.id} value={lvl.id}>
                            {lvl.name} ({lvl.id} · +{lvl.elevation} mm)
                          </option>
                        ))}
                      </select>
                    </label>

                    {/* Wall Height */}
                    <label
                      className={`bq-field ${
                        learningGuide.primaryFields.includes('height')
                          ? 'bq-field-primary'
                          : ''
                      }`}
                    >
                      <span>
                        Unconnected Height / Yükseklik (mm)
                        {learningGuide.primaryFields.includes('height') && (
                          <em className="bq-primary-field-tag">★ Aktif Parametre</em>
                        )}
                      </span>
                      <MmStepperField
                        testId="prop-input-height"
                        draft={editDrafts.height ?? ''}
                        current={numericProp('height')}
                        min={500}
                        disabled={!isFieldEditable('height')}
                        onDraftChange={(v) => setEditDrafts({ ...editDrafts, height: v })}
                        onCommit={(v) => commitSingleField('height', v)}
                        onKeyDown={(e) =>
                          handleFieldKeyDown(e, 'height', () =>
                            commitSingleField('height', editDrafts.height)
                          )
                        }
                      />
                      
                    </label>

                    {/* Wall Thickness */}
                    <label
                      className={`bq-field ${
                        learningGuide.primaryFields.includes('thickness')
                          ? 'bq-field-primary'
                          : ''
                      }`}
                    >
                      <span>
                        Structure Thickness / Kalınlık (mm)
                        {learningGuide.primaryFields.includes('thickness') && (
                          <em className="bq-primary-field-tag">★ Aktif Parametre</em>
                        )}
                      </span>
                      <MmStepperField
                        testId="prop-input-thickness"
                        draft={editDrafts.thickness ?? ''}
                        current={numericProp('thickness')}
                        min={50}
                        disabled={!isFieldEditable('thickness')}
                        onDraftChange={(v) => setEditDrafts({ ...editDrafts, thickness: v })}
                        onCommit={(v) => commitSingleField('thickness', v)}
                        onKeyDown={(e) =>
                          handleFieldKeyDown(e, 'thickness', () =>
                            commitSingleField('thickness', editDrafts.thickness)
                          )
                        }
                      />
                    </label>

                    {/* Start X / Z */}
                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>Başlangıç X (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-start-x"
                          disabled={!isFieldEditable('start')}
                          value={editDrafts.startX ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              startX: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('start')) commitCoordPair('start');
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'startX', () =>
                              commitCoordPair('start')
                            )
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Başlangıç Z (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-start-z"
                          disabled={!isFieldEditable('start')}
                          value={editDrafts.startZ ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              startZ: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('start')) commitCoordPair('start');
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'startZ', () =>
                              commitCoordPair('start')
                            )
                          }
                        />
                      </label>
                    </div>

                    {/* End X / Z */}
                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>Bitiş X (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-end-x"
                          disabled={!isFieldEditable('end')}
                          value={editDrafts.endX ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              endX: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('end')) commitCoordPair('end');
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'endX', () =>
                              commitCoordPair('end')
                            )
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Bitiş Z (mm)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          data-testid="prop-input-end-z"
                          disabled={!isFieldEditable('end')}
                          value={editDrafts.endZ ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              endZ: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('end')) commitCoordPair('end');
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'endZ', () =>
                              commitCoordPair('end')
                            )
                          }
                        />
                      </label>
                    </div>

                    {/* Wall Name */}
                    <label className="bq-field">
                      <span>Ad</span>
                      <input
                        type="text"
                        data-testid="prop-input-name"
                        disabled={!isFieldEditable('name')}
                        value={editDrafts.name ?? ''}
                        onChange={(e) =>
                          setEditDrafts({ ...editDrafts, name: e.target.value })
                        }
                        onBlur={() => {
                          if (isFieldEditable('name')) {
                            commitSingleField('name', editDrafts.name);
                          }
                        }}
                        onKeyDown={(e) =>
                          handleFieldKeyDown(e, 'name', () =>
                            commitSingleField('name', editDrafts.name)
                          )
                        }
                      />
                    </label>

                    {/* Wall Move / Translation Controls (when start & end are editable) */}
                    {isFieldEditable('start') && isFieldEditable('end') && (
                      <div
                        className="bq-wall-move-box"
                        data-testid="wall-move-controls"
                      >
                        <span className="bq-move-title">
                          Duvarı Taşı (ΔX / ΔZ mm)
                        </span>
                        <div className="bq-move-nudge-grid">
                          <button
                            type="button"
                            className="bq-chip-btn"
                            data-testid="nudge-wall-west"
                            onClick={() => handleMoveSelectedWall(-500, 0)}
                          >
                            ← Batı (−500 X)
                          </button>
                          <button
                            type="button"
                            className="bq-chip-btn"
                            data-testid="nudge-wall-east"
                            onClick={() => handleMoveSelectedWall(500, 0)}
                          >
                            Doğu (+500 X) →
                          </button>
                          <button
                            type="button"
                            className="bq-chip-btn"
                            data-testid="nudge-wall-south"
                            onClick={() => handleMoveSelectedWall(0, -500)}
                          >
                            ↓ Güney (−500 Z)
                          </button>
                          <button
                            type="button"
                            className="bq-chip-btn"
                            data-testid="nudge-wall-north"
                            onClick={() => handleMoveSelectedWall(0, 500)}
                          >
                            ↑ Kuzey (+500 Z)
                          </button>
                        </div>
                        <div className="bq-move-custom-row">
                          <label className="bq-field">
                            <span>ΔX (mm)</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              data-testid="move-delta-x"
                              value={moveDelta.dx}
                              onChange={(e) =>
                                setMoveDelta({ ...moveDelta, dx: e.target.value })
                              }
                            />
                          </label>
                          <label className="bq-field">
                            <span>ΔZ (mm)</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              data-testid="move-delta-z"
                              value={moveDelta.dz}
                              onChange={(e) =>
                                setMoveDelta({ ...moveDelta, dz: e.target.value })
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="bq-btn bq-btn-secondary bq-btn-compact"
                            data-testid="move-wall-btn"
                            onClick={() =>
                              handleMoveSelectedWall(moveDelta.dx, moveDelta.dz)
                            }
                          >
                            Taşı
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : selectedElement.type === 'door' ? (
                  /* Door Property Inspector */
                  <div
                    className="bq-prop-form"
                    data-testid={`prop-form-${selectedElement.id}`}
                  >
                    <div className="bq-prop-readonly-row">
                      <span>Kimlik (ID):</span>
                      <strong data-testid="selected-element-id">
                        {selectedElement.id} (Kapı)
                      </strong>
                    </div>

                    <label className="bq-field">
                      <span>Taşıyıcı Duvar (hostWallId)</span>
                      <select
                        data-testid="prop-input-hostWallId"
                        disabled={!isFieldEditable('hostWallId')}
                        value={
                          editDrafts.hostWallId ?? selectedElement.hostWallId
                        }
                        onChange={(e) => {
                          setEditDrafts({
                            ...editDrafts,
                            hostWallId: e.target.value,
                          });
                          commitSingleField('hostWallId', e.target.value);
                        }}
                      >
                        {wallsInModel.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.id} ({w.name})
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>Ofset (mm)</span>
                        <MmStepperField
                        testId="prop-input-offset"
                        draft={editDrafts.offset ?? ''}
                        current={numericProp('offset')}
                        min={0}
                        disabled={!isFieldEditable('offset')}
                        onDraftChange={(v) => setEditDrafts({ ...editDrafts, offset: v })}
                        onCommit={(v) => commitSingleField('offset', v)}
                        onKeyDown={(e) =>
                          handleFieldKeyDown(e, 'offset', () =>
                            commitSingleField('offset', editDrafts.offset)
                          )
                        }
                      />
                      </label>
                      <label className="bq-field">
                        <span>Genişlik (mm)</span>
                        <MmStepperField
                        testId="prop-input-width"
                        draft={editDrafts.width ?? ''}
                        current={numericProp('width')}
                        min={300}
                        disabled={!isFieldEditable('width')}
                        onDraftChange={(v) => setEditDrafts({ ...editDrafts, width: v })}
                        onCommit={(v) => commitSingleField('width', v)}
                        onKeyDown={(e) =>
                          handleFieldKeyDown(e, 'width', () =>
                            commitSingleField('width', editDrafts.width)
                          )
                        }
                      />
                      </label>
                      <label className="bq-field">
                        <span>Yükseklik (mm)</span>
                        <MmStepperField
                        testId="prop-input-height"
                        draft={editDrafts.height ?? ''}
                        current={numericProp('height')}
                        min={500}
                        disabled={!isFieldEditable('height')}
                        onDraftChange={(v) => setEditDrafts({ ...editDrafts, height: v })}
                        onCommit={(v) => commitSingleField('height', v)}
                        onKeyDown={(e) =>
                          handleFieldKeyDown(e, 'height', () =>
                            commitSingleField('height', editDrafts.height)
                          )
                        }
                      />
                      </label>
                      <label className="bq-field">
                        <span>Eşik / Sill (mm)</span>
                        <MmStepperField
                        testId="prop-input-sill"
                        draft={editDrafts.sill ?? ''}
                        current={numericProp('sill')}
                        min={0}
                        disabled={!isFieldEditable('sill')}
                        onDraftChange={(v) => setEditDrafts({ ...editDrafts, sill: v })}
                        onCommit={(v) => commitSingleField('sill', v)}
                        onKeyDown={(e) =>
                          handleFieldKeyDown(e, 'sill', () =>
                            commitSingleField('sill', editDrafts.sill)
                          )
                        }
                      />
                      </label>
                    </div>

                    <div className="bq-form-grid-2">
                      <label className="bq-field">
                        <span>İşaret (Mark)</span>
                        <input
                          type="text"
                          data-testid="prop-input-mark"
                          disabled={!isFieldEditable('mark')}
                          value={editDrafts.mark ?? ''}
                          onChange={(e) =>
                            setEditDrafts({
                              ...editDrafts,
                              mark: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (isFieldEditable('mark')) {
                              commitSingleField('mark', editDrafts.mark);
                            }
                          }}
                          onKeyDown={(e) =>
                            handleFieldKeyDown(e, 'mark', () =>
                              commitSingleField('mark', editDrafts.mark)
                            )
                          }
                        />
                      </label>
                      <label className="bq-field">
                        <span>Yangın Sınıfı</span>
                        <select
                          data-testid="prop-input-fireRating"
                          disabled={!isFieldEditable('fireRating')}
                          value={
                            editDrafts.fireRating ??
                            (selectedElement as DoorElement).fireRating
                          }
                          onChange={(e) => {
                            setEditDrafts({
                              ...editDrafts,
                              fireRating: e.target.value,
                            });
                            commitSingleField('fireRating', e.target.value);
                          }}
                        >
                          <option value="none">none</option>
                          <option value="EI30">EI30</option>
                          <option value="EI60">EI60</option>
                        </select>
                      </label>
                    </div>
                  </div>
                ) : (
                  <>
                  <GenericElementForm
                    model={model}
                    selectedElement={selectedElement}
                    editDrafts={editDrafts}
                    setEditDrafts={setEditDrafts}
                    isFieldEditable={isFieldEditable}
                    commitSingleField={commitSingleField}
                    handleFieldKeyDown={handleFieldKeyDown}
                  />
                  <TypePanel
                    model={model}
                    selectedElement={selectedElement}
                    session={session}
                    canEditType={task.permissions.editableFields.includes('typeParams')}
                    applyResult={applyResult}
                  />
                  </>
                )}
              </div>
            </div>
          )}
        </aside>
  </>
);
