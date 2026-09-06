import { StateStore } from "../core/state-store.js";
import { getAdapter } from "../providers/index.js";
import { EnvironmentRecord } from "../types/index.js";
import { isExpired } from "../utils/ttl.js";

export interface ReapResult {
  name: string;
  reaped: boolean;
  error?: string;
}

export async function destroyAndForget(
  store: StateStore,
  env: EnvironmentRecord,
): Promise<void> {
  const adapter = getAdapter(env.provider);
  await adapter.destroyEnvironment(env);
  await store.deleteEnvironment(env.name);
}

export async function reapIfExpired(
  store: StateStore,
  env: EnvironmentRecord,
): Promise<ReapResult> {
  if (!isExpired(env)) {
    return { name: env.name, reaped: false };
  }
  try {
    await destroyAndForget(store, env);
    return { name: env.name, reaped: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { name: env.name, reaped: false, error: message };
  }
}

export async function reapExpiredEnvironments(
  store: StateStore,
): Promise<ReapResult[]> {
  const environments = await store.listEnvironments();
  const results: ReapResult[] = [];
  for (const env of environments) {
    if (!isExpired(env)) {
      continue;
    }
    results.push(await reapIfExpired(store, env));
  }
  return results;
}
