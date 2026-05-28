import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPlan extends Document {
  userId: string;
  name: string;
  workoutPlan: {
    schedule: string[];
    exercises: {
      day: string;
      routines: {
        name: string;
        sets?: number;
        reps?: number;
        duration?: string;
        description?: string;
        exercises?: string[];
      }[];
    }[];
  };
  dietPlan: {
    dailyCalories: number;
    meals: {
      name: string;
      foods: string[];
    }[];
  };
  isActive: boolean;
}

const PlanSchema: Schema<IPlan> = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    workoutPlan: {
      schedule: [{ type: String }],
      exercises: [
        {
          day: { type: String },
          routines: [
            {
              name: { type: String },
              sets: { type: Number },
              reps: { type: Number },
              duration: { type: String },
              description: { type: String },
              exercises: [{ type: String }],
            },
          ],
        },
      ],
    },
    dietPlan: {
      dailyCalories: { type: Number },
      meals: [
        {
          name: { type: String },
          foods: [{ type: String }],
        },
      ],
    },
    isActive: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const Plan: Model<IPlan> =
  mongoose.models.Plan || mongoose.model<IPlan>("Plan", PlanSchema);
