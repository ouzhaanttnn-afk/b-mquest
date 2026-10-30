import React from 'react';
import { SAVE_STORAGE_KEY } from '../domain/persistence';

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

/** Last line of defence: a render error shows a way out instead of a blank page. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private exportSave = () => {
    try {
      const raw = window.localStorage.getItem(SAVE_STORAGE_KEY) ?? '{}';
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bimquest-yedek.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Nothing more we can do here.
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="bq-error-screen" role="alert" data-testid="error-boundary">
        <h1>Bir şeyler ters gitti</h1>
        <p>
          İlerlemen silinmedi. Sayfayı yeniden yüklemeyi dene; sorun sürerse ilerlemeni dışa aktarıp
          bana ilet.
        </p>
        <div className="bq-error-actions">
          <button type="button" className="bq-btn bq-btn-primary" onClick={() => this.setState({ error: null })}>
            Yeniden dene
          </button>
          <button type="button" className="bq-btn bq-btn-secondary" onClick={() => window.location.reload()}>
            Sayfayı yenile
          </button>
          <button type="button" className="bq-btn bq-btn-secondary" onClick={this.exportSave}>
            İlerlemeyi dışa aktar
          </button>
        </div>
        <pre className="bq-error-detail">{this.state.error.message}</pre>
      </div>
    );
  }
}
