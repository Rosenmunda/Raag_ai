import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import connectToDatabase from "@/lib/db";
import { User } from "@/models/User";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error(
      "Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "No svix headers found" }, { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(webhookSecret);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return NextResponse.json({ error: "Error occurred" }, { status: 400 });
  }

  const eventType = evt.type;

  await connectToDatabase();

  if (eventType === "user.created") {
    const { id, first_name, last_name, image_url, email_addresses } = evt.data;
    const email = email_addresses?.[0]?.email_address;
    const name = `${first_name || ""} ${last_name || ""}`.trim();

    try {
      await User.create({
        clerkId: id,
        email,
        name,
        image: image_url,
      });
    } catch (error) {
      console.log("Error creating user in DB:", error);
      return NextResponse.json({ error: "Error creating user" }, { status: 500 });
    }
  }

  if (eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    const email = email_addresses?.[0]?.email_address;
    const name = `${first_name || ""} ${last_name || ""}`.trim();

    try {
      await User.findOneAndUpdate(
        { clerkId: id },
        {
          email,
          name,
          image: image_url,
        }
      );
    } catch (error) {
      console.log("Error updating user in DB:", error);
      return NextResponse.json({ error: "Error updating user" }, { status: 500 });
    }
  }

  return NextResponse.json({ message: "Webhook processed successfully" }, { status: 200 });
}
