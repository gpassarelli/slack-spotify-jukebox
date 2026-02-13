import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSongQuery } from '../src/message-parser.js';

test('extractSongQuery returns null for empty input', () => {
  assert.equal(extractSongQuery(''), null);
  assert.equal(extractSongQuery(null), null);
});

test('extractSongQuery parses command and strips prefix', () => {
  assert.equal(extractSongQuery('play daft punk harder better faster stronger'), 'daft punk harder better faster stronger');
});

test('extractSongQuery supports case insensitive prefix', () => {
  assert.equal(extractSongQuery('PLAY Numb Linkin Park'), 'Numb Linkin Park');
});

test('extractSongQuery ignores non-command messages', () => {
  assert.equal(extractSongQuery('hello everyone'), null);
});

test('extractSongQuery supports custom prefix', () => {
  assert.equal(extractSongQuery('add Mr. Brightside', 'add'), 'Mr. Brightside');
});
