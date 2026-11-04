import React from 'react';

/** The wordmark in both themes: "BIM" is dark ink on light, light ink on dark. */
export const BrandLogo: React.FC<{ width: number; height: number; className?: string }> = ({ width, height, className }) => (
  <>
    <img src="./assets/brand/logo-horizontal.svg" alt="BIM QUEST" width={width} height={height} className={`bq-logo-light ${className ?? ''}`} />
    <img src="./assets/brand/logo-horizontal-dark.svg" alt="BIM QUEST" width={width} height={height} className={`bq-logo-dark ${className ?? ''}`} />
  </>
);
