# Pile 337 Landing Page

Next.js + Tailwind landing page for Lithuim Hub's Pile 337 offer.

## Local Checks

```bash
npm install
npm run typecheck
npm run build
```

The app uses:

- Home landing page at `/`
- Thank-you page at `/thank-you`
- Order validation endpoint at `/api/orders`
- Admin panel at `/admin` (password: flormar2024)

## Environment Variables

Create these in Vercel Project Settings > Environment Variables:

```env
NEXT_PUBLIC_META_PIXEL_ID=
CONTACT_EMAIL=
NEXT_PUBLIC_WHATSAPP_NUMBER=
```

- `NEXT_PUBLIC_META_PIXEL_ID`: Meta Pixel ID. Leave empty until ready.
- `CONTACT_EMAIL`: destination/contact email to wire into the future order notification integration.
- `NEXT_PUBLIC_WHATSAPP_NUMBER`: WhatsApp number in international format, for example `216XXXXXXXX`.

## Notes

Meta Pixel PageView is enabled on all pages only when `NEXT_PUBLIC_META_PIXEL_ID` is set.
Purchase is tracked only after a successful order submission.
