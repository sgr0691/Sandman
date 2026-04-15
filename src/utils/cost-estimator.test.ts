import { describe, it, expect } from "vitest";
import {
  calculateEstimate,
  calculateRunningCost,
  formatCost,
  formatHourlyRate,
  SERVICE_COSTS,
  BASE_COSTS,
} from "./cost-estimator.js";
import { ServiceName } from "../types/index.js";

describe("Cost Estimator", () => {
  describe("calculateEstimate", () => {
    it("should calculate cost for AWS services", () => {
      const services: ServiceName[] = ["ec2", "s3"];
      const estimate = calculateEstimate("aws", services);

      expect(estimate.hourlyRate).toBeGreaterThan(0);
      expect(estimate.services).toHaveLength(3); // base + ec2 + s3
      expect(estimate.dailyRate).toBe(estimate.hourlyRate * 24);
      expect(estimate.monthlyRate).toBe(estimate.hourlyRate * 24 * 30);
    });

    it("should calculate cost for GCP services", () => {
      const services: ServiceName[] = ["compute", "storage", "cloudrun"];
      const estimate = calculateEstimate("gcp", services);

      expect(estimate.hourlyRate).toBeGreaterThan(0);
      expect(estimate.services).toHaveLength(3);
      expect(estimate.dailyRate).toBe(estimate.hourlyRate * 24);
    });

    it("should return base cost only when no services enabled", () => {
      const estimate = calculateEstimate("aws", []);

      expect(estimate.hourlyRate).toBe(BASE_COSTS.aws);
      expect(estimate.services).toHaveLength(1); // Just base
    });

    it("should return zero for unknown provider", () => {
      const estimate = calculateEstimate("unknown", ["ec2"]);

      expect(estimate.hourlyRate).toBe(0);
    });

    it("should include IAM at no cost", () => {
      const services: ServiceName[] = ["ec2", "iam"];
      const estimate = calculateEstimate("aws", services);

      const iamService = estimate.services.find((s) => s.name === "iam");
      expect(iamService?.hourlyRate).toBe(0);
    });
  });

  describe("calculateRunningCost", () => {
    it("should calculate running cost based on elapsed time", () => {
      // Create a date 5 hours ago
      const createdAt = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
      const services: ServiceName[] = ["ec2"];

      const runningCost = calculateRunningCost("aws", services, createdAt);

      expect(runningCost.hoursRunning).toBeCloseTo(5, 0);
      expect(runningCost.totalCost).toBeGreaterThan(0);
      expect(runningCost.hourlyRate).toBe(
        SERVICE_COSTS.aws.ec2 + BASE_COSTS.aws,
      );
    });

    it("should handle newly created environments", () => {
      const createdAt = new Date().toISOString();
      const services: ServiceName[] = ["compute"];

      const runningCost = calculateRunningCost("gcp", services, createdAt);

      expect(runningCost.hoursRunning).toBeCloseTo(0, 1);
      expect(runningCost.totalCost).toBeCloseTo(0, 2);
    });
  });

  describe("formatCost", () => {
    it("should format zero cost", () => {
      expect(formatCost(0)).toBe("$0.00");
    });

    it("should format very small cost", () => {
      expect(formatCost(0.001)).toBe("<$0.01");
    });

    it("should format normal cost", () => {
      expect(formatCost(12.3456)).toBe("$12.35");
    });
  });

  describe("formatHourlyRate", () => {
    it("should format zero rate", () => {
      expect(formatHourlyRate(0)).toBe("$0.00/hour");
    });

    it("should format very small rate", () => {
      expect(formatHourlyRate(0.001)).toBe("<$0.01/hour");
    });

    it("should format normal rate", () => {
      expect(formatHourlyRate(0.1234)).toBe("$0.123/hour");
    });
  });
});
