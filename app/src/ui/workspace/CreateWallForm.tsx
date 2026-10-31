import React from 'react';
import { WALL_QUICK_PRESETS } from './format';

import type { PropertyInspectorProps } from './PropertyInspector';

/** Revit-style wall form: create a wall by typing coordinates. */
export const CreateWallForm: React.FC<Pick<PropertyInspectorProps, 'activeTool' | 'task' | 'handleCreateWallSubmit' | 'setActiveTool' | 'setWallForm' | 'wallForm' | 'model'>> = ({
  activeTool,
  task,
  handleCreateWallSubmit,
  setActiveTool,
  setWallForm,
  wallForm,
  model,
}) => (
  <>
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

  </>
);
