export interface CommandError {
  code: string;
  field?: string;
  message: string;
}


export const FIELD_LABELS_TR: Record<string, string> = {
  height: 'Yükseklik',
  thickness: 'Kalınlık',
  width: 'Genişlik',
  offset: 'Başlangıç Ofseti',
  sill: 'Eşik Yüksekliği',
  startX: 'Başlangıç X',
  startZ: 'Başlangıç Z',
  endX: 'Bitiş X',
  endZ: 'Bitiş Z',
  start: 'Başlangıç Koordinatı',
  end: 'Bitiş Koordinatı',
  name: 'Ad',
  mark: 'Kapı İşareti (Mark)',
  fireRating: 'Yangın Sınıfı',
  topOffset: 'Üst Ofset',
  slope: 'Eğim',
  overhang: 'Çıkma',
  riserHeight: 'Basamak Yüksekliği',
  treadDepth: 'Basamak Derinliği',
  risers: 'Basamak Sayısı',
  elevation: 'Kot',
  baseLevelId: 'Kat Referansı',
  hostWallId: 'Taşıyıcı Duvar',
};

export function parseStrictIntegerMm(
  raw: unknown,
  fieldKey: string,
  min: number,
  max: number
): { ok: true; value: number } | { ok: false; error: CommandError } {
  const label = FIELD_LABELS_TR[fieldKey] ?? fieldKey;

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
      return {
        ok: false,
        error: {
          code: 'E_INVALID_INTEGER',
          field: fieldKey,
          message: `${label} alanı tam sayı (mm) olmalıdır.`,
        },
      };
    }
    if (raw < min || raw > max) {
      return {
        ok: false,
        error: {
          code: 'E_OUT_OF_RANGE',
          field: fieldKey,
          message: `${label} alanı ${min} ile ${max} mm arasında olmalıdır.`,
        },
      };
    }
    return { ok: true, value: raw };
  }

  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: {
        code: 'E_INVALID_INTEGER',
        field: fieldKey,
        message: `${label} alanı geçerli bir tam sayı (mm) olmalıdır.`,
      },
    };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: {
        code: 'E_EMPTY_FIELD',
        field: fieldKey,
        message: `${label} alanı boş bırakılamaz.`,
      },
    };
  }

  if (
    trimmed.includes(',') ||
    trimmed.includes('.') ||
    trimmed.toLowerCase().includes('e') ||
    !/^-?\d+$/.test(trimmed)
  ) {
    return {
      ok: false,
      error: {
        code: 'E_NON_INTEGER',
        field: fieldKey,
        message: `${label} alanı ondalık veya bilimsel gösterim içeremez; tam sayı mm girin.`,
      },
    };
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) {
    return {
      ok: false,
      error: {
        code: 'E_INVALID_INTEGER',
        field: fieldKey,
        message: `${label} alanı geçerli sınırlar dışında.`,
      },
    };
  }

  if (parsed < min || parsed > max) {
    return {
      ok: false,
      error: {
        code: 'E_OUT_OF_RANGE',
        field: fieldKey,
        message: `${label} alanı ${min} ile ${max} mm arasında olmalıdır.`,
      },
    };
  }

  return { ok: true, value: parsed };
}

export function normalizeTextField(
  raw: unknown,
  fieldKey: string
): { ok: true; value: string } | { ok: false; error: CommandError } {
  const label = FIELD_LABELS_TR[fieldKey] ?? fieldKey;
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: {
        code: 'E_INVALID_TEXT',
        field: fieldKey,
        message: `${label} alanı metin olmalıdır.`,
      },
    };
  }
  const normalized = raw.trim().normalize('NFC');
  if (normalized.length < 1 || normalized.length > 80) {
    return {
      ok: false,
      error: {
        code: 'E_TEXT_LENGTH',
        field: fieldKey,
        message: `${label} alanı 1–80 karakter arasında olmalıdır.`,
      },
    };
  }
  return { ok: true, value: normalized };
}
