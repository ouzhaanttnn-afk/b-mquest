import React from 'react';
import type { BimModel } from '../../domain/types';

export interface MobileTabBarProps {
  mobileDrawerTab: "brief" | "inspector" | "check";
  mobileSheetOpen: boolean;
  setMobileSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMobileDrawerTab: React.Dispatch<React.SetStateAction<"brief" | "inspector" | "check">>;
  model: BimModel;
  selectedId: string | null;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  mobileDrawerTab,
  mobileSheetOpen,
  setMobileSheetOpen,
  setMobileDrawerTab,
  model,
  selectedId,
}) => (
  <>
      <nav
        className="bq-mobile-tabbar"
        aria-label="Mobil Çalışma Alanı Sekmeleri"
      >
        <button
          type="button"
          data-testid="mobile-tab-brief"
          className={`bq-mobile-tab ${
            mobileDrawerTab === 'brief' && mobileSheetOpen ? 'active' : ''
          }`}
          onClick={() => {
            if (mobileDrawerTab === 'brief' && mobileSheetOpen) {
              setMobileSheetOpen(false);
            } else {
              setMobileDrawerTab('brief');
              setMobileSheetOpen(true);
            }
          }}
        >
          📋 Görev & İpucu
        </button>
        <button
          type="button"
          data-testid="mobile-tab-inspector"
          className={`bq-mobile-tab ${
            mobileDrawerTab === 'inspector' && mobileSheetOpen ? 'active' : ''
          }`}
          onClick={() => {
            if (mobileDrawerTab === 'inspector' && mobileSheetOpen) {
              setMobileSheetOpen(false);
            } else {
              setMobileDrawerTab('inspector');
              setMobileSheetOpen(true);
            }
          }}
        >
          🧱 Nesneler ({model.elements.length})
          {selectedId ? ` · ${selectedId}` : ''}
        </button>
        <button
          type="button"
          data-testid="mobile-tab-check"
          className={`bq-mobile-tab ${
            mobileDrawerTab === 'check' && mobileSheetOpen ? 'active' : ''
          }`}
          onClick={() => {
            if (mobileDrawerTab === 'check' && mobileSheetOpen) {
              setMobileSheetOpen(false);
            } else {
              setMobileDrawerTab('check');
              setMobileSheetOpen(true);
            }
          }}
        >
          ✓ Kontrol & Sonuç
        </button>
      </nav>
  </>
);
