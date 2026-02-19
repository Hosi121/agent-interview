import type { SubscriptionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: SubscriptionStatus,
) {
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId },
  });

  if (!subscription) {
    logger.warn("Stripe webhook: subscription not found", {
      stripeSubscriptionId,
    });
    return null;
  }

  return prisma.subscription.update({
    where: { id: subscription.id },
    data: { status },
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    logger.error("Stripe webhook signature verification failed", err as Error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as Record<string, unknown>;
      const sub = invoice.subscription;
      const stripeSubscriptionId =
        typeof sub === "string" ? sub : (sub as { id?: string })?.id;
      if (stripeSubscriptionId) {
        await updateSubscriptionStatus(stripeSubscriptionId, "PAST_DUE");
        logger.info("Subscription marked as PAST_DUE", {
          stripeSubscriptionId,
        });
      }
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as unknown as Record<string, unknown>;
      const sub = invoice.subscription;
      const stripeSubscriptionId =
        typeof sub === "string" ? sub : (sub as { id?: string })?.id;
      if (stripeSubscriptionId) {
        await updateSubscriptionStatus(stripeSubscriptionId, "ACTIVE");
        logger.info("Subscription marked as ACTIVE", {
          stripeSubscriptionId,
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await updateSubscriptionStatus(subscription.id, "CANCELED");
      logger.info("Subscription marked as CANCELED", {
        stripeSubscriptionId: subscription.id,
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
