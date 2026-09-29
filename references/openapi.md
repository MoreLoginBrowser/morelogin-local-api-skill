# OpenAPI provenance

Four unmodified upstream snapshots live in specs/. sources.json records URLs,
versions and SHA256 hashes. npm run sync:openapi merges those snapshots;
npm run sync:openapi -- --fetch refreshes them from the official site.
Review changes before updating the expected 113-operation baseline.

Component definitions are namespaced per source and every internal reference is
rewritten consistently. Conflicting routes fail rather than silently overwrite.
npm run validate checks all internal refs and deterministic output/checksums.

Known source inconsistencies: some patterns contain double-escaped \\d tokens;
some integer examples are strings; browser identity descriptions allow uniqueId
where required lists still require envId; proxy deletion uses integer int64 items
while most resource IDs are strings. Do not invent conversions or silently round
large IDs. Use the unambiguous documented form (envId, string cloud-phone IDs).
Schema tests report their limited normalization of patterns/formats; they cannot
prove what a real server accepts. Snapshots and bundled YAML remain unmodified
apart from merge/namespacing. Confirm ambiguous contracts against the vendor.
