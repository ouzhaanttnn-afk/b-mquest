import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';

describe('ErrorBoundary', () => {
  it('renders children when nothing fails', () => {
    expect(renderToString(<ErrorBoundary><p>merhaba</p></ErrorBoundary>)).toContain('merhaba');
  });
  it('turns a thrown error into a recovery screen', () => {
    const err = new Error('boom');
    const state = ErrorBoundary.getDerivedStateFromError(err);
    expect(state.error).toBe(err);
    const inst = new ErrorBoundary({ children: null });
    inst.state = state;
    const html = renderToString(inst.render() as never);
    expect(html).toContain('Bir şeyler ters gitti');
    expect(html).toContain('boom');
    vi.restoreAllMocks();
  });
});
