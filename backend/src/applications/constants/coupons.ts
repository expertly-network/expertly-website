// Placeholder coupon system — no real payment gateway integration yet, and
// per docs/database-erd.md's deliberate "no coupons table" decision, this is
// plain application code, not DB-backed. Add/remove codes here directly
// until a real, admin-manageable coupon system is built.
interface CouponDefinition {
  discountType: 'full_waiver' | 'percentage' | 'fixed_amount';
  /** Percentage (0-100) for 'percentage', cents for 'fixed_amount'. Unused for 'full_waiver'. */
  value?: number;
}

const COUPONS: Record<string, CouponDefinition> = {
  LAUNCH100: { discountType: 'full_waiver' },
};

export type CouponResult =
  | { valid: true; discountAmountCents: number }
  | { valid: false };

export function applyCoupon(code: string | undefined, listPriceCents: number): CouponResult {
  if (!code) return { valid: true, discountAmountCents: 0 };

  const def = COUPONS[code.trim().toUpperCase()];
  if (!def) return { valid: false };

  if (def.discountType === 'full_waiver') {
    return { valid: true, discountAmountCents: listPriceCents };
  }
  if (def.discountType === 'percentage') {
    return { valid: true, discountAmountCents: Math.round(listPriceCents * (def.value! / 100)) };
  }
  // fixed_amount — clamp so a discount can never exceed the list price.
  return { valid: true, discountAmountCents: Math.min(def.value!, listPriceCents) };
}
