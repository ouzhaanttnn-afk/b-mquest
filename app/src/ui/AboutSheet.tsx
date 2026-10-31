import React from 'react';

export const APP_VERSION = '1.0.0';
export const SUPPORT_URL = 'https://github.com/ouzhaanttnn-afk/b-mquest/issues';

/** About, privacy summary and credits. Mirrors store/PRIVACY.md. */
export const AboutSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div
    className="bq-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="Hakkında ve gizlilik"
    data-testid="about-sheet"
    onClick={onClose}
  >
    <div className="bq-modal-card" onClick={(e) => e.stopPropagation()}>
      <div className="bq-form-title-row">
        <h2>Hakkında & Gizlilik</h2>
        <button type="button" className="bq-chip-btn" onClick={onClose}>✕ Kapat</button>
      </div>
      <p>
        <strong>BIM QUEST</strong> · sürüm <span data-testid="app-version">{APP_VERSION}</span>
      </p>
      <p className="bq-sched-note">
        Revit’i oynayarak öğreten bağımsız bir eğitim oyunudur. Autodesk ile bağlantısı yoktur;
        Revit, Autodesk’in tescilli markasıdır.
      </p>
      <h3>Gizlilik</h3>
      <ul className="bq-about-list" data-testid="privacy-summary">
        <li>Hesap yok, giriş yok, reklam yok.</li>
        <li>İlerlemen, ayarların ve istatistiklerin yalnızca bu cihazda saklanır.</li>
        <li>Hiçbir kişisel veri toplanmaz, hiçbir sunucuya gönderilmez.</li>
        <li>Üçüncü taraf izleme ya da analitik kullanılmaz.</li>
        <li>Günlük hatırlatma isteğe bağlıdır; bildirim izni ancak sen açarsan istenir.</li>
        <li>Verilerini Ayarlar’dan dışa aktarabilir ya da tamamen silebilirsin.</li>
      </ul>
      <h3>Destek</h3>
      <p>
        Sorun ya da öneri için:{' '}
        <a href={SUPPORT_URL} target="_blank" rel="noreferrer noopener" data-testid="support-link">
          {SUPPORT_URL.replace('https://', '')}
        </a>
      </p>
    </div>
  </div>
);
