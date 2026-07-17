import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATIVE_COSTS, RESOURCE_TYPES, serializePlan, usageRemaining } from '../server/account-shared.js';

test('creative costs separate generation from included analysis', () => {
  assert.equal(CREATIVE_COSTS.analyze, 0);
  assert.equal(CREATIVE_COSTS.sketch, 15);
  assert.equal(CREATIVE_COSTS.outpaint, 20);
});

test('usage remaining subtracts used and reserved quota', () => {
  const period = {
    processing_frame_limit: 100,
    processing_frames_used: 30,
    processing_frames_reserved: 20,
    creative_credit_limit: 50,
    creative_credits_used: 10,
    creative_credits_reserved: 5,
  };
  assert.equal(usageRemaining(period, RESOURCE_TYPES.PROCESSING_FRAMES), 50);
  assert.equal(usageRemaining(period, RESOURCE_TYPES.CREATIVE_CREDITS), 35);
});

test('public plan serialization exposes market quota fields', () => {
  const plan = serializePlan({
    code: 'pro', name: 'Pro Beta', description: 'x', price_vnd: 499000,
    duration_days: 30, credits_grant: 500, project_limit: 50,
    processing_frame_limit: 2000, creative_credit_limit: 500,
    creative_daily_limit: 40, creative_concurrent_limit: 2,
    priority_queue: true, high_quality_export: true, version_history_days: 30,
    features: ['2,000 Processing Frames/month', '500 Creative Credits/month'], sort_order: 20,
  });
  assert.equal(plan.processingFrameLimit, 2000);
  assert.equal(plan.creativeCreditLimit, 500);
  assert.equal(plan.features.some((feature) => /project/i.test(feature)), false);
  assert.equal(plan.priceVnd, 499000);
});
