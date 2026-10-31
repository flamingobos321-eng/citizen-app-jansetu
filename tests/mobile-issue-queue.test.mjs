import assert from 'node:assert/strict';
import test from 'node:test';
import { filterOfficeIssues, getOfficeIssueStatuses } from '../artifacts/jansetu-mobile/lib/issueQueue.ts';

const issues = [
  { id: '1', issue_code: 'JS1000-001', title: 'Street light repair', status: 'Assigned' },
  { id: '2', issue_code: 'JS1000-002', title: 'Water supply', status: 'Resolved' },
  { id: '3', issue_code: 'JS1000-003', title: 'Street light inspection', status: 'Under Review' },
  { id: '4', issue_code: 'JS1000-004', title: 'रस्त्यावरील दिवे', status: 'Assigned' },
];

test('no filters and whitespace return the authorized queue unchanged', () => {
  assert.deepEqual(filterOfficeIssues(issues, '  ', null), issues);
  assert.deepEqual(filterOfficeIssues([], '', null), []);
});

test('search is case insensitive, trims whitespace, and searches codes and titles', () => {
  assert.deepEqual(filterOfficeIssues(issues, '  js1000-002  ', null).map(x => x.id), ['2']);
  assert.deepEqual(filterOfficeIssues(issues, 'STREET light', null).map(x => x.id), ['1', '3']);
  assert.deepEqual(filterOfficeIssues(issues, 'JS1000 repair', null).map(x => x.id), ['1']);
});

test('supports Marathi search and combines status with keywords', () => {
  assert.deepEqual(filterOfficeIssues(issues, 'दिवे', 'Assigned').map(x => x.id), ['4']);
  assert.deepEqual(filterOfficeIssues(issues, 'street', 'Under Review').map(x => x.id), ['3']);
  assert.deepEqual(filterOfficeIssues(issues, 'water', 'Assigned'), []);
});

test('statuses cover the full queue and remove duplicates', () => {
  assert.deepEqual(getOfficeIssueStatuses(issues), ['Assigned', 'Resolved', 'Under Review']);
  assert.deepEqual(getOfficeIssueStatuses([]), []);
});

test('filtering runs before pagination, including matches beyond the first 30', () => {
  const queue = Array.from({ length: 65 }, (_, index) => ({
    id: String(index), issue_code: `ISS-${index}`,
    title: index >= 31 ? 'Drain repair' : 'Road repair', status: 'Assigned',
  }));
  const filtered = filterOfficeIssues(queue, 'Drain', 'Assigned');
  assert.equal(filtered.length, 34);
  assert.equal(filtered.slice(0, 30)[0].id, '31');
  assert.equal(filtered.slice(0, 60).length, 34);
});

test('does not modify the supplied records or invent unauthorized results', () => {
  const original = structuredClone(issues);
  assert.deepEqual(filterOfficeIssues(issues.slice(0, 1), 'water', null), []);
  filterOfficeIssues(issues, 'street', 'Assigned');
  assert.deepEqual(issues, original);
});
