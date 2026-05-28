import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { Plan } from "@/models/Plan";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await connectToDatabase();

    // Fetch plans sorted by creation date descending
    const plans = await Plan.find({ userId }).sort({ createdAt: -1 }).lean();

    // Mongoose documents need to be serialized properly (specifically _id)
    const serializedPlans = plans.map((plan: any) => ({
      ...plan,
      _id: plan._id.toString(),
    }));

    return NextResponse.json(serializedPlans, { status: 200 });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
