import { HOUSE1_DEF } from './house1';
import { HOUSE2_DEF } from './house2';
import type { HouseDef } from './model';

/** The campaign, house by house. Each house unlocks when the one before has every level done. */
export const HOUSES: HouseDef[] = [HOUSE1_DEF, HOUSE2_DEF];

/** Houses still being built; shown on the home screen as "yakında". */
export const COMING_SOON = [
  { id: 'teslim', title: 'Teslim', brief: 'Kapı tipleri, ölçü, kapı listesi ve pafta.' },
  { id: 'hata-avi', title: 'Hata Avı', brief: 'Hazır bir evdeki BIM hatalarını bul ve düzelt.' },
];
