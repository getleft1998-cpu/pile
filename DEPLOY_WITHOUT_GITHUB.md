# Deploy Without GitHub on Windows

This guide deploys the Pile 337 Next.js project directly from your local folder to Vercel. No GitHub repository is required.

## 1. Unzip the Project

Unzip `pile-337-nextjs-vercel.zip` or the latest provided ZIP file.

Open the unzipped folder. Make sure you can see `package.json` inside it.

## 2. Open Terminal Inside the Project Folder

In Windows File Explorer:

1. Open the unzipped project folder.
2. Click the address bar.
3. Type `powershell`.
4. Press Enter.

PowerShell should open directly inside the project folder.

## 3. Install Dependencies

Run:

```powershell
npm.cmd install
```

If you want to check the project before deploying, run:

```powershell
npm.cmd run build
```

## 4. Login to Vercel

Run:

```powershell
npx.cmd --yes vercel@latest login
```

Follow the browser or email login instructions from Vercel.

## 5. Deploy Directly to Vercel

Run this from the same project folder:

```powershell
npx.cmd --yes vercel@latest deploy --prod
```

On the first deploy, Vercel may ask setup questions. Use these answers:

```text
Set up and deploy? Yes
Which scope? Choose your Vercel account
Link to existing project? No
Project name? pile-337
In which directory is your code located? ./
Want to modify settings? No
```

When deployment finishes, Vercel will print your live production URL.

## 6. Add Environment Variables Later

After deploy:

1. Open the project in the Vercel dashboard.
2. Go to Settings > Environment Variables.
3. Add these variables:

```env
NEXT_PUBLIC_META_PIXEL_ID=
CONTACT_EMAIL=
NEXT_PUBLIC_WHATSAPP_NUMBER=
```

Recommended values:

```env
NEXT_PUBLIC_META_PIXEL_ID=your_meta_pixel_id
CONTACT_EMAIL=orders@example.com
NEXT_PUBLIC_WHATSAPP_NUMBER=216XXXXXXXX
```

Notes:

- Leave `NEXT_PUBLIC_META_PIXEL_ID` empty until your Meta Pixel is ready.
- `NEXT_PUBLIC_WHATSAPP_NUMBER` should use Tunisia/international format without spaces, for example `21699123456`.
- After changing environment variables, redeploy from the Vercel dashboard or run the deploy command again.

## Future Updates

After editing the site locally, deploy the newest version again with:

```powershell
npx.cmd --yes vercel@latest deploy --prod
```
