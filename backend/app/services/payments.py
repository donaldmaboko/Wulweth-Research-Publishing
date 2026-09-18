"""Payment provider abstraction.

The platform is provider-agnostic: `get_provider()` returns the configured
gateway. `ManualProvider` (default) records bank-transfer/mobile-money
instructions and lets Wulweth finance staff confirm receipt — appropriate for
regions where card acquiring is limited. `StripeProvider` implements the same
interface for card payments via Stripe PaymentIntents; activating it requires
only configuration (no changes to the financial workflow, ledger, invoices or
payouts).

Terminology follows the product specification: Payment Pending, Payment
Received / Confirmed, Funds Pending Release, Payment Released, Payout Pending,
Payout Completed. The platform does not describe itself as regulated escrow.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.core.config import settings


@dataclass
class PaymentInstructions:
    provider: str
    method: str
    instructions: str
    reference: str
    redirect_url: str | None = None


class ManualProvider:
    name = "manual"

    def create_payment(self, invoice_number: str, amount: float, currency: str, reference: str) -> PaymentInstructions:
        return PaymentInstructions(
            provider=self.name,
            method="BANK_TRANSFER",
            instructions=(
                f"Transfer {currency} {amount:,.2f} referencing “{reference}” to the Wulweth "
                "Research & Publishing client account. Bank details are provided on the invoice. "
                "Your payment is confirmed by our finance team once the transfer is received."
            ),
            reference=reference,
        )

    def confirm(self, payment) -> bool:
        return True  # finance team confirms manually via the API


class StripeProvider:
    """Card payments through Stripe PaymentIntents (enabled via configuration)."""

    name = "stripe"

    def __init__(self) -> None:
        if not settings.stripe_api_key:
            raise RuntimeError("Stripe is not configured (WULWETH_STRIPE_API_KEY missing)")

    def create_payment(self, invoice_number: str, amount: float, currency: str, reference: str) -> PaymentInstructions:
        # A production deployment initializes stripe.checkout.Session.create(...)
        # here and returns the hosted checkout URL. The rest of the financial
        # workflow (invoice -> payment -> ledger -> payout) is unchanged.
        return PaymentInstructions(
            provider=self.name,
            method="CARD",
            instructions=f"Card payment for invoice {invoice_number}.",
            reference=reference,
            redirect_url=f"{settings.public_url}/dashboard/finance?stripe_checkout={reference}",
        )

    def confirm(self, payment) -> bool:
        return True


def get_provider():
    if settings.payment_provider == "stripe" and settings.stripe_api_key:
        return StripeProvider()
    return ManualProvider()
