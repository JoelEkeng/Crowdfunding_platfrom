import { z } from "zod";

const utf8Length = (value: string) => new TextEncoder().encode(value).length;

export const rewardTierSchema = z.object({
  minimum: z.string().trim().min(1, "Enter a minimum pledge"),
  perk: z
    .string()
    .trim()
    .min(1, "Describe the perk")
    .refine((v) => utf8Length(v) <= 500, "Perk must be 500 bytes or fewer"),
});

export const campaignSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .refine((v) => utf8Length(v) <= 100, "Title must be 100 bytes or fewer"),
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .refine(
        (v) => utf8Length(v) <= 2_000,
        "Description must be 2,000 bytes or fewer",
      ),
    imageURI: z
      .string()
      .trim()
      .refine(
        (v) => utf8Length(v) <= 500,
        "Image URI must be 500 bytes or fewer",
      ),
    goal: z
      .string()
      .trim()
      .min(1, "Goal is required")
      .refine(
        (v) => /^\d+(\.\d+)?$/.test(v) && Number(v) > 0,
        "Enter a positive token amount",
      ),
    deadline: z.string().min(1, "Deadline is required"),
    tiers: z.array(rewardTierSchema).max(20),
  })
  .superRefine((value, context) => {
    const deadline = new Date(value.deadline).getTime();
    const duration = deadline - Date.now();
    if (
      !Number.isFinite(deadline) ||
      duration < 3_600_000 ||
      duration > 365 * 86_400_000
    ) {
      context.addIssue({
        code: "custom",
        path: ["deadline"],
        message: "Deadline must be between 1 hour and 365 days away",
      });
    }
    let previous = 0;
    value.tiers.forEach((tier, index) => {
      const current = Number(tier.minimum);
      if (!Number.isFinite(current) || current <= previous) {
        context.addIssue({
          code: "custom",
          path: ["tiers", index, "minimum"],
          message: "Tier minimums must increase",
        });
      }
      previous = current;
    });
  });

export type CampaignFormValues = z.infer<typeof campaignSchema>;
