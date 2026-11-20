import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizePickedDocument,
  resolvePickerOrigin,
  truncateStudyMaterial,
} from './pickerHelpers';

test('resolvePickerOrigin returns top-most ancestor origin when inside iframe', () => {
  assert.equal(
    resolvePickerOrigin(['https://inner.example.com', 'https://aistudio.google.com'], 'http://localhost:3000'),
    'https://aistudio.google.com'
  );
  assert.equal(resolvePickerOrigin([], 'http://localhost:3000'), 'http://localhost:3000');
  assert.equal(resolvePickerOrigin(undefined, 'https://app.example.com'), 'https://app.example.com');
});

test('normalizePickedDocument handles docs, folders, and invalid inputs safely', () => {
  const doc = normalizePickedDocument({
    id: 'file-123',
    name: '学单词范本',
    mimeType: 'application/vnd.google-apps.document',
    url: 'https://docs.google.com/document/d/file-123/edit',
    parentId: 'folder-1',
  });
  assert.deepEqual(doc, {
    id: 'file-123',
    name: '学单词范本',
    mimeType: 'application/vnd.google-apps.document',
    url: 'https://docs.google.com/document/d/file-123/edit',
    parentId: 'folder-1',
    isFolder: false,
  });

  const folder = normalizePickedDocument({
    id: 'folder-99',
    name: '英语学习笔记',
    mimeType: 'application/vnd.google-apps.folder',
  });
  assert.equal(folder?.isFolder, true);
  assert.equal(normalizePickedDocument({}), null);
  assert.equal(normalizePickedDocument(null), null);
});

test('truncateStudyMaterial preserves short texts and cleanly truncates long docs', () => {
  const shortRes = truncateStudyMaterial('Simple daily disciplines compound over time.', 200);
  assert.equal(shortRes.truncated, false);
  assert.equal(shortRes.text, 'Simple daily disciplines compound over time.');

  const longInput = 'A'.repeat(4000);
  const longRes = truncateStudyMaterial(longInput, 100);
  assert.equal(longRes.truncated, true);
  assert.equal(longRes.originalLength, 4000);
  assert.ok(longRes.text.startsWith('A'.repeat(100)));
  assert.ok(longRes.text.includes('已截取前 100 字符'));
});
