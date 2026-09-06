import { EnableResult, ServiceName } from "../types/index.js";

export function enableResult(opts: {
  recorded: ServiceName[];
  provisioned: ServiceName[];
  localOnly: ServiceName[];
  warnings?: string[];
}): EnableResult {
  const { recorded, provisioned, localOnly, warnings } = opts;
  let mode: EnableResult["mode"] = "cloud";
  if (localOnly.length > 0 && provisioned.length > 0) {
    mode = "mixed";
  } else if (localOnly.length > 0) {
    mode = "local-only";
  }
  return {
    mode,
    recorded,
    provisioned,
    localOnly,
    ...(warnings?.length ? { warnings } : {}),
  };
}

export function localOnlyEnable(
  provider: string,
  services: ServiceName[],
  reason: string,
): EnableResult {
  return enableResult({
    recorded: services,
    provisioned: [],
    localOnly: services,
    warnings: [reason],
  });
}
