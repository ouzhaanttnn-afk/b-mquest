import React from 'react';
import { getWallLengthMm } from '../../plan/geometry';

import type { PropertyInspectorProps } from './PropertyInspector';

/** Door form: place a hosted door by typing its values. */
export const CreateDoorForm: React.FC<Pick<PropertyInspectorProps, 'activeTool' | 'task' | 'setActiveTool' | 'handleCreateDoorSubmit' | 'doorForm' | 'setDoorForm' | 'wallsInModel'>> = ({
  activeTool,
  task,
  setActiveTool,
  handleCreateDoorSubmit,
  doorForm,
  setDoorForm,
  wallsInModel,
}) => (
  <>
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

  </>
);
