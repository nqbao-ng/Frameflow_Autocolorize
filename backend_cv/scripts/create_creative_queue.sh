#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-ap-southeast-1}"
MAIN_QUEUE="${FRAMEFLOW_CREATIVE_QUEUE_NAME:-frameflow-creative-jobs}"
DLQ_NAME="${FRAMEFLOW_CREATIVE_DLQ_NAME:-frameflow-creative-jobs-dlq}"
TMP_ATTRIBUTES="$(mktemp)"
trap 'rm -f "$TMP_ATTRIBUTES"' EXIT

aws sqs create-queue \
  --region "$REGION" \
  --queue-name "$DLQ_NAME" \
  --attributes MessageRetentionPeriod=1209600 >/dev/null

DLQ_URL="$(aws sqs get-queue-url --region "$REGION" --queue-name "$DLQ_NAME" --query QueueUrl --output text)"
DLQ_ARN="$(aws sqs get-queue-attributes --region "$REGION" --queue-url "$DLQ_URL" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)"

aws sqs create-queue \
  --region "$REGION" \
  --queue-name "$MAIN_QUEUE" >/dev/null

MAIN_URL="$(aws sqs get-queue-url --region "$REGION" --queue-name "$MAIN_QUEUE" --query QueueUrl --output text)"

python3 - "$DLQ_ARN" "$TMP_ATTRIBUTES" <<'PY'
import json
import sys

dlq_arn, output_path = sys.argv[1], sys.argv[2]
attributes = {
    "VisibilityTimeout": "180",
    "MessageRetentionPeriod": "1209600",
    "ReceiveMessageWaitTimeSeconds": "20",
    "RedrivePolicy": json.dumps({
        "deadLetterTargetArn": dlq_arn,
        "maxReceiveCount": "5",
    }),
}
with open(output_path, "w", encoding="utf-8") as handle:
    json.dump(attributes, handle)
PY

aws sqs set-queue-attributes \
  --region "$REGION" \
  --queue-url "$MAIN_URL" \
  --attributes "file://$TMP_ATTRIBUTES"

MAIN_ARN="$(aws sqs get-queue-attributes --region "$REGION" --queue-url "$MAIN_URL" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)"

echo "FRAMEFLOW_CREATIVE_QUEUE_URL=$MAIN_URL"
echo "Queue ARN: $MAIN_ARN"
echo "DLQ URL: $DLQ_URL"
