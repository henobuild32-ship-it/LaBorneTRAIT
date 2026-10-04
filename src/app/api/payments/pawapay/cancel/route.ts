import { NextResponse } from 'next/server';

export async function GET() {
  return new Response(`
    <html>
      <head>
        <title>Redirection...</title>
        <script>
          window.location.href = '/?page=admin-cards&payment=cancel';
        </script>
      </head>
      <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
        <div style="text-align: center; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
          <h2 style="color: #1e293b; margin: 0 0 0.5rem 0;">Paiement Annulé</h2>
          <p style="color: #64748b; margin: 0 0 1.5rem 0;">La transaction a été annulée.</p>
          <p style="color: #94a3b8; font-size: 0.875rem;">Redirection vers LaBorneTRAIT...</p>
        </div>
      </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
