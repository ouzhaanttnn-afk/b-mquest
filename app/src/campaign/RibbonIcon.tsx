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
      {id === 'dimension' && (
        <>
          <path d="M3 9v8M21 9v8" />
          <path d="M3 13h18" />
          <path d="M5 11l-2 2 2 2M19 11l2 2-2 2" />
        </>
      )}
      {id === 'elevation' && (
        <>
          <circle cx="12" cy="13" r="5" />
          <path d="M12 3l4 5H8z" fill="currentColor" />
        </>
      )}
      {id === 'sheet' && (
        <>
          <rect x="3" y="5" width="18" height="14" />
          <path d="M15 5v14M15 15h6" />
        </>
      )}
      {id === 'place' && (
        <>
          <rect x="3" y="5" width="18" height="14" />
          <rect x="6" y="8" width="7" height="6" />
          <path d="M16 11h3M17.5 9.5v3" />
        </>
      )}
      {id === 'mirror' && (
        <>
          <path d="M12 3v18" strokeDasharray="3 2" />
          <path d="M9 7 4 12l5 5z" />
          <path d="M15 7l5 5-5 5z" fill="currentColor" />
        </>
      )}
      {id === 'column' && (
        <>
          <rect x="9" y="3" width="6" height="18" />
          <path d="M6 3h12M6 21h12" />
        </>
      )}
      {id === 'array' && (
        <>
          <rect x="3" y="15" width="5" height="5" />
          <rect x="10" y="10" width="5" height="5" />
          <rect x="17" y="5" width="4" height="4" />
        </>
      )}
      {id === 'curtaingrid' && <path d="M4 3h16v18H4zM10 3v18M16 3v18" />}
      {id === 'mullion' && (
        <>
          <path d="M4 3h16v18H4z" />
          <path d="M10 3v18M16 3v18M4 12h16" strokeWidth="3" />
        </>
      )}
      {id === 'assistant' && (
        <>
          <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z" fill="currentColor" stroke="none" />
          <path d="M18 15l.8 1.7 1.7.8-1.7.8L18 20l-.8-1.7-1.7-.8 1.7-.8z" fill="currentColor" stroke="none" />
        </>
      )}
      {id === 'review' && (
        <>
          <circle cx="10" cy="10" r="6" />
          <path d="M14.5 14.5 20 20M7.5 10l2 2 3-4" />
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
