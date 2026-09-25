import { test, assert } from 'vitest';
import { History } from '@shared/core/history';

test('desfazer e refazer', () => {
  const h = new History({ n: 0 });
  h.edit('um', (d) => { d.n = 1; });
  h.edit('dois', (d) => { d.n = 2; });
  assert.equal(h.undo(), 'dois');
  assert.equal(h.current.n, 1);
  assert.equal(h.redo(), 'dois');
  assert.equal(h.current.n, 2);
  h.undo();
  h.edit('três', (d) => { d.n = 3; });
  assert.isFalse(h.canRedo);
});

test('checkpoint sem mudança é descartado', () => {
  const h = new History({ n: 0 });
  h.checkpoint('arrastar');
  h.dropIfUnchanged();
  assert.isFalse(h.canUndo);
});
