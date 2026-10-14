import test from 'node:test';
import assert from 'node:assert/strict';
import { announcementDetails } from '../ui/src/lib/selling-announcement.ts';

test('extracts explicit announcement details', () => {
  assert.deepEqual(announcementDetails('iPhone 14\nCutie inclusă. Preț: 1500,50 lei\nLocalitate: București'), { title: 'iPhone 14', price: '1500.50', location: 'București' });
});
test('does not guess ambiguous prices, foreign currencies or unlabeled locations', () => {
  for (const text of ['Produs\n100 lei sau 90 lei', 'Produs\n100 EUR, București', 'Produs\n1.500 lei']) {
    assert.equal(announcementDetails(text).price, '');
    assert.equal(announcementDetails(text).location, '');
  }
});
