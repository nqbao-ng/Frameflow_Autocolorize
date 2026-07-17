import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCvSettings } from '../server/colorization-shared.js';

test('CV defaults close edge halos without aggressive role-memory overrides', () => {
  const settings = buildCvSettings({});
  assert.equal(settings.edge_fill_radius, 4);
  assert.equal(settings.color_sample_erode, 1);
  assert.equal(settings.role_memory_override_max_confidence, 0.55);
  assert.equal(settings.use_flow, true);
});

test('CV edge-fit settings remain configurable per job', () => {
  const settings = buildCvSettings({
    edge_fill_radius: 6,
    color_sample_erode: 2,
    role_memory_override_max_confidence: 0.4,
  });
  assert.equal(settings.edge_fill_radius, 6);
  assert.equal(settings.color_sample_erode, 2);
  assert.equal(settings.role_memory_override_max_confidence, 0.4);
});
