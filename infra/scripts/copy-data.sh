#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Copies one environment's diagrams table and scenes bucket from one AWS account to another, then compares them.

  copy-data.sh [--compare-only] \
    --source-profile P --target-profile P \
    --source-table T --target-table T \
    --source-bucket B --target-bucket B

Reads only from the source, writes only to the target, and is safe to run again:
items are put whole and an object already identical in the target is skipped.
Only current object versions are copied.
Prints item and object counts and every difference; exits 1 if any remains.
EOF
  exit 2
}

compare_only=false
while [ $# -gt 0 ]; do
  case "$1" in
    --compare-only) compare_only=true; shift ;;
    --source-profile) src_profile=$2; shift 2 ;;
    --target-profile) dst_profile=$2; shift 2 ;;
    --source-table) src_table=$2; shift 2 ;;
    --target-table) dst_table=$2; shift 2 ;;
    --source-bucket) src_bucket=$2; shift 2 ;;
    --target-bucket) dst_bucket=$2; shift 2 ;;
    *) usage ;;
  esac
done
for v in src_profile dst_profile src_table dst_table src_bucket dst_bucket; do
  [ -n "${!v:-}" ] || usage
done

export AWS_REGION=us-east-1
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

src() { aws --profile "$src_profile" "$@"; }
dst() { aws --profile "$dst_profile" "$@"; }

scan() {
  "$1" dynamodb scan --table-name "$2" --consistent-read --output json | jq -S '.Items | sort_by(.id.S)'
}

copy_table() {
  scan src "$src_table" > "$work/items.json"
  local total
  total=$(jq length "$work/items.json")
  for ((i = 0; i < total; i += 25)); do
    jq --arg t "$dst_table" --argjson i "$i" \
      '{($t): [.[$i:$i + 25][] | {PutRequest: {Item: .}}]}' "$work/items.json" > "$work/batch.json"
    while :; do
      dst dynamodb batch-write-item --request-items "file://$work/batch.json" --output json > "$work/left.json"
      jq -e '.UnprocessedItems | length > 0' "$work/left.json" > /dev/null || break
      jq '.UnprocessedItems' "$work/left.json" > "$work/batch.json"
      sleep 1
    done
  done
  echo "table: put $total items into $dst_table"
}

compare_table() {
  scan src "$src_table" > "$work/src-items.json"
  scan dst "$dst_table" > "$work/dst-items.json"
  echo "table: $(jq length "$work/src-items.json") items in source, $(jq length "$work/dst-items.json") in target"
  jq -n --slurpfile a "$work/src-items.json" --slurpfile b "$work/dst-items.json" -r '
    ($a[0] | map({(.id.S): .}) | add // {}) as $s |
    ($b[0] | map({(.id.S): .}) | add // {}) as $d |
    (($s | keys) + ($d | keys) | unique)[] as $k |
    if $s[$k] == null then "table: only in target \($k)"
    elif $d[$k] == null then "table: only in source \($k)"
    elif $s[$k] != $d[$k] then "table: attributes differ \($k)"
    else empty end' > "$work/table-diff.txt"
  cat "$work/table-diff.txt"
  [ ! -s "$work/table-diff.txt" ]
}

list_keys() {
  "$1" s3api list-objects-v2 --bucket "$2" --output json | jq -r '.Contents // [] | .[].Key' | LC_ALL=C sort
}

describe() {
  "$1" s3api head-object --bucket "$2" --key "$3" --output json 2> /dev/null |
    jq -S '{ContentLength, ETag, ContentType, CacheControl, ContentEncoding, ContentDisposition, Metadata: (.Metadata // {})}'
}

copy_bucket() {
  local copied=0 skipped=0 key
  list_keys src "$src_bucket" > "$work/src-keys.txt"
  while IFS= read -r key; do
    describe src "$src_bucket" "$key" > "$work/src-head.json"
    if describe dst "$dst_bucket" "$key" > "$work/dst-head.json" && cmp -s "$work/src-head.json" "$work/dst-head.json"; then
      skipped=$((skipped + 1))
      continue
    fi
    src s3api get-object --bucket "$src_bucket" --key "$key" "$work/body" > /dev/null
    args=(--bucket "$dst_bucket" --key "$key" --body "$work/body" --metadata "$(jq -c .Metadata "$work/src-head.json")")
    for field in ContentType CacheControl ContentEncoding ContentDisposition; do
      value=$(jq -r --arg f "$field" '.[$f] // empty' "$work/src-head.json")
      flag=$(echo "$field" | sed -E 's/([a-z])([A-Z])/\1-\2/g' | tr '[:upper:]' '[:lower:]')
      [ -z "$value" ] || args+=("--$flag" "$value")
    done
    dst s3api put-object "${args[@]}" > /dev/null
    copied=$((copied + 1))
  done < "$work/src-keys.txt"
  echo "bucket: copied $copied objects into $dst_bucket, $skipped already identical"
}

compare_bucket() {
  local key differ=0
  list_keys src "$src_bucket" > "$work/src-keys.txt"
  list_keys dst "$dst_bucket" > "$work/dst-keys.txt"
  echo "bucket: $(wc -l < "$work/src-keys.txt") objects in source, $(wc -l < "$work/dst-keys.txt") in target"
  comm -23 "$work/src-keys.txt" "$work/dst-keys.txt" | sed 's/^/bucket: only in source /'
  comm -13 "$work/src-keys.txt" "$work/dst-keys.txt" | sed 's/^/bucket: only in target /'
  [ -z "$(comm -3 "$work/src-keys.txt" "$work/dst-keys.txt")" ] || differ=1
  while IFS= read -r key; do
    describe src "$src_bucket" "$key" > "$work/src-head.json"
    describe dst "$dst_bucket" "$key" > "$work/dst-head.json"
    if jq -e '.ETag | contains("-")' "$work/src-head.json" > /dev/null; then
      a=$(src s3 cp "s3://$src_bucket/$key" - | sha256sum)
      b=$(dst s3 cp "s3://$dst_bucket/$key" - | sha256sum)
      jq 'del(.ETag)' "$work/src-head.json" > "$work/a.json"
      jq 'del(.ETag)' "$work/dst-head.json" > "$work/b.json"
      [ "$a" = "$b" ] && cmp -s "$work/a.json" "$work/b.json" && continue
    else
      cmp -s "$work/src-head.json" "$work/dst-head.json" && continue
    fi
    echo "bucket: differs $key"
    differ=1
  done < <(comm -12 "$work/src-keys.txt" "$work/dst-keys.txt")
  return $differ
}

if [ "$compare_only" = false ]; then
  copy_table
  copy_bucket
fi

status=0
compare_table || status=1
compare_bucket || status=1
[ $status -eq 0 ] && echo "match: every item and every object is identical"
exit $status
