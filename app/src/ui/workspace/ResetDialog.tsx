import React from 'react';
import type { MissionSessionState } from '../../domain/commands';
import { resetMissionSession } from '../../domain/commands';

export interface ResetDialogProps {
  resetModalOpen: boolean;
  resetCancelBtnRef: React.RefObject<HTMLButtonElement | null>;
  setResetModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  resetTriggerBtnRef: React.RefObject<HTMLButtonElement | null>;
  session: MissionSessionState;
  onResetDraftConfirmed: (resetSession: MissionSessionState) => void;
  setStatusToast: React.Dispatch<React.SetStateAction<string | null>>;
}

export const ResetDialog: React.FC<ResetDialogProps> = ({
  resetModalOpen,
  resetCancelBtnRef,
  setResetModalOpen,
  resetTriggerBtnRef,
  session,
  onResetDraftConfirmed,
  setStatusToast,
}) => (
  <>
      {/* RESET CONFIRMATION DIALOG */}
      {resetModalOpen && (
        <div
          className="bq-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
          data-testid="reset-confirm-dialog"
        >
          <div className="bq-modal-card">
            <h2 id="reset-dialog-title">Mevcut Taslağı Sıfırla</h2>
            <p>
              Bu görevdeki mevcut model değişiklikleriniz, açılan ipuçları ve
              geri alma geçmişiniz başlangıç durumuna sıfırlanacak. Daha önce
              kazandığınız en yüksek puan korunur.
            </p>
            <div className="bq-modal-actions">
              <button
                type="button"
                ref={resetCancelBtnRef}
                className="bq-btn bq-btn-secondary"
                data-testid="cancel-reset-btn"
                onClick={() => {
                  setResetModalOpen(false);
                  resetTriggerBtnRef.current?.focus();
                }}
              >
                İptal
              </button>
              <button
                type="button"
                className="bq-btn bq-btn-danger"
                data-testid="confirm-reset-btn"
                onClick={() => {
                  const resetState = resetMissionSession(session);
                  onResetDraftConfirmed(resetState);
                  setResetModalOpen(false);
                  setStatusToast('Görev başlangıç durumuna sıfırlandı.');
                  resetTriggerBtnRef.current?.focus();
                }}
              >
                Evet, Sıfırla
              </button>
            </div>
          </div>
        </div>
      )}
  </>
);
