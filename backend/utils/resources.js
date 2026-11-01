function normalizeResource(resource) {
  if (!resource) return null;
  const url = String(resource.url || "").trim();
  if (!url) throw new Error("Resource URL is required");

  if (resource.kind === "file") {
    if (!url.startsWith("/uploads/") || !resource.fileName) {
      throw new Error("Uploaded resource is invalid");
    }
    return {
      kind: "file",
      label: String(resource.label || resource.fileName).trim().slice(0, 120) || "Shared file",
      url,
      fileName: String(resource.fileName).trim().slice(0, 255),
      mimeType: String(resource.mimeType || "application/octet-stream").trim().slice(0, 120),
      size: Number(resource.size) || 0,
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Resource URL must be a valid link");
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Resource URL must use HTTP or HTTPS");
  }

  return {
    kind: "link",
    label: String(resource.label || "").trim().slice(0, 120) || "Shared resource",
    url: parsedUrl.toString(),
  };
}

module.exports = { normalizeResource };
