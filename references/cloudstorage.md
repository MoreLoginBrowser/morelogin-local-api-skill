# Cloud storage

Read ../local-api.yaml for /api/cloudstorage routes and required shapes.
Upload is a transaction:

1. upload/init with fileNames.
2. PUT the exact bytes to each returned presignedUrl, including returned headers.
3. upload/complete with that file's id only after its PUT succeeds.

Presigned URLs are credentials. Keep raw output local for the authorized upload,
never paste it into shared logs. A failed or unknown PUT is not permission to
call complete. Stop on network/permission failure and report which phase failed.

Use add-tags to preserve old tags; set-tags replaces them. Empty tagIds clears
labels via --payload. Delete files/tags requires --confirm-delete true and exact
IDs/count. Cloud phone direct uploadFile is a separate multipart API, supported
by api --file; it is not the object-store PUT phase.
