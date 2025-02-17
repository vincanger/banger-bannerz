import { requireNodeEnvVar } from '../server/utils';

export type SubscriptionStatus = 'past_due' | 'cancel_at_period_end' | 'active' | 'deleted';

export enum PaymentPlanId {
  Credits30 = 'credits30',
  Credits300 = 'credits300',
  Credits100 = 'credits100',
}

export interface PaymentPlan {
  // Returns the id under which this payment plan is identified on your payment processor. 
  // E.g. this might be price id on Stripe, or variant id on LemonSqueezy.
  getPaymentProcessorPlanId: () => string;
  effect: PaymentPlanEffect;
}

export type PaymentPlanEffect = { kind: 'credits'; amount: number };

export const paymentPlans: Record<PaymentPlanId, PaymentPlan> = {
  [PaymentPlanId.Credits30]: {
    getPaymentProcessorPlanId: () => requireNodeEnvVar('PAYMENTS_CREDITS_30_PLAN_ID'),
    effect: { kind: 'credits', amount: 30 },
  },
  [PaymentPlanId.Credits100]: {
    getPaymentProcessorPlanId: () => requireNodeEnvVar('PAYMENTS_CREDITS_100_PLAN_ID'),
    effect: { kind: 'credits', amount: 100 },
  },
  [PaymentPlanId.Credits300]: {
    getPaymentProcessorPlanId: () => requireNodeEnvVar('PAYMENTS_CREDITS_300_PLAN_ID'),
    effect: { kind: 'credits', amount: 300 },
  },
};

export function prettyPaymentPlanName(planId: PaymentPlanId): string {
  const planToName: Record<PaymentPlanId, string> = {
    [PaymentPlanId.Credits30]: '30 Image Credits',
    [PaymentPlanId.Credits100]: '100 Image Credits',
    [PaymentPlanId.Credits300]: '300 Image Credits',
  };
  return planToName[planId];
}

export function parsePaymentPlanId(planId: string): PaymentPlanId {
  if ((Object.values(PaymentPlanId) as string[]).includes(planId)) {
    return planId as PaymentPlanId;
  } else {
    throw new Error(`Invalid PaymentPlanId: ${planId}`);
  }
}

export function getSubscriptionPaymentPlanIds(): PaymentPlanId[] {
  return Object.values(PaymentPlanId);
}
