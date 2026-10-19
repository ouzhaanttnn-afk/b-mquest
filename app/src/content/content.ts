import catalogJson from './missions/catalog.json';
import m01Json from './missions/m01.json';
import m02Json from './missions/m02.json';
import m03Json from './missions/m03.json';
import { buildGeneratedMissionTasks } from './revitLessons';
import { taskErrors } from '../domain/evaluator';
import type { MissionTask } from '../domain/types';

const GENERATED_MISSIONS = buildGeneratedMissionTasks();

const RAW_MISSIONS: Record<string, unknown> = {
  m01: m01Json,
  m02: m02Json,
  m03: m03Json,
  ...GENERATED_MISSIONS,
};

export interface LoadedCatalog {
  contentVersion: string;
  missions: MissionTask[];
  missionsById: Record<string, MissionTask>;
}

export function loadValidatedCatalog(
  customMissions?: Record<string, unknown>
):
  | { ok: true; catalog: LoadedCatalog }
  | { ok: false; diagnostic: string; userMessageTr: string } {
  const source = customMissions ?? RAW_MISSIONS;
  const missions: MissionTask[] = [];
  const missionsById: Record<string, MissionTask> = {};

  if (!catalogJson || catalogJson.contentVersion !== '1.0.0') {
    return {
      ok: false,
      diagnostic: 'E_CATALOG_VERSION',
      userMessageTr:
        'Görev kataloğu sürümü doğrulanamadı. Varsayılan içerik yeniden yüklenebilir.',
    };
  }

  const missionEntries = customMissions
    ? catalogJson.missions
    : [
        ...catalogJson.missions,
        ...Object.keys(GENERATED_MISSIONS).map((id) => ({ id, file: `${id}.json` })),
      ];

  for (const entry of missionEntries) {
    const rawTask = source[entry.id];
    if (!rawTask) {
      return {
        ok: false,
        diagnostic: `E_MISSING_MISSION:${entry.id}`,
        userMessageTr: `${entry.id} görev dosyası bulunamadı.`,
      };
    }
    const errs = taskErrors(rawTask);
    if (errs.length > 0) {
      return {
        ok: false,
        diagnostic: `E_TASK_INVALID:${entry.id}:${errs.join(',')}`,
        userMessageTr: `${entry.id} görev verisi şema kontrolünden geçemedi (${errs.join(', ')}).`,
      };
    }
    const task = rawTask as MissionTask;
    missions.push(task);
    missionsById[task.id] = task;
  }

  return {
    ok: true,
    catalog: {
      contentVersion: catalogJson.contentVersion,
      missions,
      missionsById,
    },
  };
}

