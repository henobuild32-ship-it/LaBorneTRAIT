import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signCardCallback } from '@/lib/payment-callback';

const STUDENT_CARD_PRICE_USD = Number(process.env.STUDENT_CARD_PRICE_USD || 10);

/**
 * GeniusPay payment initiation endpoint.
 * NOTE: kept under /pawapay path for backward compatibility.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, currency, paymentMethod, customer, description, successUrl, cancelUrl } = body;

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount !== STUDENT_CARD_PRICE_USD || currency !== 'USD' || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: 'Le prix de la carte scolaire est fixé à 10 USD.' },
        { status: 400 }
      );
    }
    const customerPhone = typeof customer?.phone === 'string' ? customer.phone.replace(/\s/g, '') : '';
    if (!['pawapay', 'card'].includes(paymentMethod) || (paymentMethod === 'pawapay' && (!/^\+243\d{9}$/.test(customerPhone) || customer?.country !== 'CD'))) {
      return NextResponse.json(
        { error: paymentMethod === 'card' ? 'Les informations de carte seront saisies sur GeniusPay.' : 'Un numéro Mobile Money RDC valide au format +243XXXXXXXXX est requis.' },
        { status: 400 }
      );
    }

    const geniusPayApiKey = process.env.GENIUSPAY_API_KEY;
    const geniusPayApiSecret = process.env.GENIUSPAY_API_SECRET;
    const geniusPayBaseUrl = (process.env.GENIUSPAY_API_BASE_URL || 'https://geniuspay.ci/api/v1/merchant').replace(/\/$/, '');

    // Fallback local: if no credentials, use integrated checkout page.
    if (
      !geniusPayApiKey ||
      !geniusPayApiSecret ||
      geniusPayApiKey.includes('placeholder') ||
      geniusPayApiSecret.includes('placeholder')
    ) {
      const checkoutUrl = new URL('/checkout', request.url);
      checkoutUrl.searchParams.set('amount', String(parsedAmount));
      checkoutUrl.searchParams.set('currency', currency);
      checkoutUrl.searchParams.set('description', description || 'LaBorneTRAIT payment');
      checkoutUrl.searchParams.set('successUrl', successUrl);
      checkoutUrl.searchParams.set('cancelUrl', cancelUrl);
      return NextResponse.json({ redirectUrl: checkoutUrl.toString() }, { status: 200 });
    }

    // Signe l'URL de succès (Phase 3) : le callback devra présenter une
    // signature valide. Uniquement pour les parcours réels passant par
    // GeniusPay — l'auto-checkout local ci-dessus n'ouvre aucun crédit.
    let finalSuccessUrl = successUrl;
    try {
      const signed = new URL(successUrl);
      const signature = signCardCallback({
        schoolId: signed.searchParams.get('schoolId'),
        action: signed.searchParams.get('action'),
        classId: signed.searchParams.get('classId'),
        userId: signed.searchParams.get('userId'),
      });
      if (signature) {
        signed.searchParams.set('ts', signature.ts);
        signed.searchParams.set('sgn', signature.sgn);
        finalSuccessUrl = signed.toString();
      }
    } catch {
      // URL invalide : on laisse l'URL d'origine (le callback devra alors
      // être vérifié via l'API GeniusPay).
    }

    const response = await fetch(`${geniusPayBaseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': geniusPayApiKey,
        'X-API-Secret': geniusPayApiSecret,
      },
      body: JSON.stringify({
        amount: parsedAmount,
        currency,
        payment_method: paymentMethod,
        customer: {
          name: typeof customer.name === 'string' ? customer.name.slice(0, 120) : 'Administrateur LaBorneTRAIT',
          phone: customerPhone,
          country: 'CD',
        },
        description: description ?? 'LaBorneTRAIT payment',
        success_url: finalSuccessUrl,
        error_url: cancelUrl,
        metadata: {
          source: 'gradeup',
          module: 'student-card',
          price_usd: String(STUDENT_CARD_PRICE_USD),
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text().catch(() => '');
      return NextResponse.json(
        { error: 'GeniusPay request failed', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    const redirectUrl =
      data?.data?.checkout_url ||
      data?.data?.payment_url ||
      data?.checkout_url ||
      data?.payment_url ||
      data?.redirectUrl;

    if (!redirectUrl) {
      return NextResponse.json(
        { error: 'GeniusPay response missing redirect URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({ redirectUrl }, { status: 200 });
  } catch (err) {
    console.error('GeniusPay endpoint error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
