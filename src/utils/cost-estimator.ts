import { ServiceName } from "../types/index.js";

// Cost rates in USD per hour
export const SERVICE_COSTS: Record<string, Record<ServiceName, number>> = {
  aws: {
    ec2: 0.0116, // t2.micro on-demand
    s3: 0.005, // per GB stored (simplified)
    lambda: 0.0000166667, // per GB-second (simplified)
    iam: 0, // IAM is free
  } as Record<ServiceName, number>,
  gcp: {
    compute: 0.0076, // e2-micro
    storage: 0.004, // per GB stored (simplified)
    cloudrun: 0.000024, // per vCPU-second (simplified)
    iam: 0, // IAM is free
    pubsub: 0.0, // per message (negligible for sandbox)
    container: 0.0076, // GKE e2-micro
    artifactregistry: 0.005, // per GB stored
  } as Record<ServiceName, number>,
};

// Base costs per provider per hour
export const BASE_COSTS: Record<string, number> = {
  aws: 0.005, // VPC and basic infrastructure
  gcp: 0.0, // GCP doesn't charge for project itself
};

export interface CostEstimate {
  hourlyRate: number;
  dailyRate: number;
  monthlyRate: number;
  services: Array<{
    name: ServiceName;
    hourlyRate: number;
  }>;
}

export interface RunningCost {
  hourlyRate: number;
  hoursRunning: number;
  totalCost: number;
  estimatedDaily: number;
  estimatedMonthly: number;
}

/**
 * Calculate estimated cost for a set of services
 */
export function calculateEstimate(
  provider: string,
  services: ServiceName[],
): CostEstimate {
  const providerCosts = SERVICE_COSTS[provider] || {};
  const baseCost = BASE_COSTS[provider] || 0;

  let hourlyRate = baseCost;
  const serviceBreakdown: Array<{ name: ServiceName; hourlyRate: number }> = [];

  for (const service of services) {
    const cost = providerCosts[service] || 0;
    hourlyRate += cost;
    serviceBreakdown.push({ name: service, hourlyRate: cost });
  }

  // Add base cost as a line item if > 0
  if (baseCost > 0) {
    serviceBreakdown.unshift({
      name: "base" as ServiceName,
      hourlyRate: baseCost,
    });
  }

  return {
    hourlyRate,
    dailyRate: hourlyRate * 24,
    monthlyRate: hourlyRate * 24 * 30,
    services: serviceBreakdown,
  };
}

/**
 * Calculate running cost based on elapsed time
 */
export function calculateRunningCost(
  provider: string,
  services: ServiceName[],
  createdAt: string,
): RunningCost {
  const estimate = calculateEstimate(provider, services);
  const created = new Date(createdAt);
  const now = new Date();
  const hoursRunning = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

  return {
    hourlyRate: estimate.hourlyRate,
    hoursRunning: Math.round(hoursRunning * 10) / 10, // Round to 1 decimal
    totalCost: Math.round(estimate.hourlyRate * hoursRunning * 100) / 100,
    estimatedDaily: estimate.dailyRate,
    estimatedMonthly: estimate.monthlyRate,
  };
}

/**
 * Format cost as a readable string
 */
export function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

/**
 * Format hourly rate with proper units
 */
export function formatHourlyRate(rate: number): string {
  if (rate === 0) return "$0.00/hour";
  if (rate < 0.01) return "<$0.01/hour";
  return `$${rate.toFixed(3)}/hour`;
}
