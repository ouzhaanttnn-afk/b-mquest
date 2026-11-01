import React from 'react';
import type { CommandId } from './model';

/** Small line icons in the spirit of Revit's ribbon buttons. */
export const RibbonIcon: React.FC<{ id: CommandId }> = ({ id }) => {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...common}>
      {id === 'wall' && (
        <>
          <rect x="3" y="8" width="18" height="8" />
          <path d="M7 8v8M11 8v8M15 8v8M19 8v8" strokeWidth="1" />
        </>
      )}
      {id === 'door' && (
        <>
          <path d="M3 19h18" />
          <path d="M7 19V7" />
          <path d="M7 7a12 12 0 0 1 12 12" strokeDasharray="2 2" />
        </>
      )}
      {id === 'window' && (
        <>
          <rect x="4" y="5" width="16" height="14" />
          <path d="M12 5v14M4 12h16" />
        </>
      )}
      {id === 'floor' && <path d="M6 9h15l-3 7H3z" />}
      {id === 'roof' && (
        <>
          <path d="M2 13 12 5l10 8" />
          <path d="M5 11v8h14v-8" />
        </>
      )}
      {id === 'room' && (
        <>
          <rect x="4" y="4" width="16" height="16" strokeDasharray="3 2" />
          <path d="M9 12h6" />
        </>
      )}
      {id === 'level' && (
        <>
          <path d="M3 15h14" />
          <path d="M17 15l2-3h2l-2 3 2 3h-2z" fill="currentColor" stroke="none" />
          <path d="M3 9h14" strokeDasharray="2 2" />
        </>
      )}
      {id === 'grid' && (
        <>
          <circle cx="12" cy="5" r="3" />
          <path d="M12 8v13" strokeDasharray="4 2" />
        </>
      )}
      {id === 'stair' && <path d="M3 20h5v-4h4v-4h4V8h5" />}
      {id === 'section' && (
        <>
          <path d="M12 3v18" strokeDasharray="3 2" />
          <path d="M12 3h6l-2 3" />
          <circle cx="12" cy="20" r="1.6" fill="currentColor" />
        </>
      )}
      {id === 'paste' && (
        <>
          <rect x="6" y="5" width="12" height="16" rx="1.5" />
          <path d="M9 5V3h6v2" />
          <path d="M9 12h6M9 16h6" />
        </>
      )}
      {id === 'tag' && (
        <>
          <path d="M3 7h12l5 5-5 5H3z" />
          <circle cx="7" cy="12" r="1.2" fill="currentColor" />
        </>
      )}
    </svg>
  );
};
