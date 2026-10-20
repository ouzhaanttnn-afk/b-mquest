import React from 'react';
import type { MissionTask, BimModel, EditableField, SubmittedEvaluation } from '../../domain/types';
import type { MissionSessionState } from '../../domain/commands';
import type { DoorDraftPreview, PlanToolProps, WallDraftPreview } from '../../plan/PlanViewport';
import type { ToolId } from './toolActions';
import { PlanViewport } from '../../plan/PlanViewport';
import { updateElementProperty } from '../../domain/commands';
import { SceneViewport } from '../../scene/SceneViewport';

export interface StageViewportsProps {
  viewMode: "split" | "plan" | "3d";
  setViewMode: React.Dispatch<React.SetStateAction<"split" | "plan" | "3d">>;
  task: MissionTask;
  model: BimModel;
  selectedId: string | null;
  failedElementIds: Set<string>;
  activeTool: ToolId;
  wallPreview: WallDraftPreview | null;
  doorPreview: DoorDraftPreview | null;
  theme: "light" | "dark";
  isFieldEditable: (field: EditableField) => boolean;
  handleSelectElement: (id: string | null) => void;
  planTools: PlanToolProps;
  session: MissionSessionState;
  onSessionChange: (next: MissionSessionState, passingEvaluation?: SubmittedEvaluation) => void;
  setStatusToast: React.Dispatch<React.SetStateAction<string | null>>;
  reducedMotion: boolean;
}

export const StageViewports: React.FC<StageViewportsProps> = ({
  viewMode,
  setViewMode,
  task,
  model,
  selectedId,
  failedElementIds,
  activeTool,
  wallPreview,
  doorPreview,
  theme,
  isFieldEditable,
  handleSelectElement,
  planTools,
  session,
  onSessionChange,
  setStatusToast,
  reducedMotion,
}) => (
  <>
          <div className="bq-stage-switcher" role="tablist" aria-label="Görünüm Modu Seçimi">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'split'}
              className={`bq-tab-btn ${viewMode === 'split' ? 'active' : ''}`}
              data-testid="view-mode-split"
              onClick={() => setViewMode('split')}
            >
              Plan + 3B Bölünmüş
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'plan'}
              className={`bq-tab-btn ${viewMode === 'plan' ? 'active' : ''}`}
              data-testid="view-mode-plan"
              onClick={() => setViewMode('plan')}
            >
              Yalnız 2B Plan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === '3d'}
              className={`bq-tab-btn ${viewMode === '3d' ? 'active' : ''}`}
              data-testid="view-mode-3d"
              onClick={() => setViewMode('3d')}
            >
              Yalnız 3B Sahne
            </button>
          </div>

          <div className={`bq-viewports-grid mode-${viewMode}`}>
            {(viewMode === 'split' || viewMode === 'plan') && (
              <div className="bq-viewport-pane">
                <PlanViewport
                  task={task}
                  model={model}
                  selectedId={selectedId}
                  failedElementIds={failedElementIds}
                  activeTool={activeTool}
                  wallPreview={wallPreview}
                  doorPreview={doorPreview}
                  theme={theme}
                  canDragWallEndpoints={
                    isFieldEditable('start') && isFieldEditable('end')
                  }
                  onSelect={handleSelectElement}
                  {...planTools}
                  onDragWallEndpoint={(wallId, which, coord) => {
                    const res = updateElementProperty(
                      session,
                      wallId,
                      which,
                      coord
                    );
                    if (res.ok) {
                      onSessionChange(res.state);
                      setStatusToast(
                        `${wallId} ${which === 'start' ? 'başlangıç' : 'bitiş'} ucu (${coord[0]}, ${coord[1]}) mm konumuna taşındı.`
                      );
                    }
                  }}
                />
              </div>
            )}

            {(viewMode === 'split' || viewMode === '3d') && (
              <div className="bq-viewport-pane">
                <SceneViewport
                  task={task}
                  model={model}
                  selectedId={selectedId}
                  failedElementIds={failedElementIds}
                  reducedMotion={reducedMotion}
                  isVisible={viewMode === 'split' || viewMode === '3d'}
                  theme={theme}
                  onSelect={handleSelectElement}
                />
              </div>
            )}
          </div>
  </>
);
