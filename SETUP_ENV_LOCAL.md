# Google Maps API Key Setup Instructions

## Step 1: Create `.env.local` File

Create a file named `.env.local` in the **root directory** of your project (same folder as `package.json`).

**Location:** `f:\Downloads\THESIS\web app working\.env.local`

## Step 2: Add Your API Key

Open `.env.local` and add the following line (replace with your actual API key):

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyBLUtu-gHBd3Zgb5o-RLnufFKo5u9IgtJM
```

**Important:**
- No spaces around the `=` sign
- No quotes around the API key
- No trailing spaces or empty lines
- File must be named exactly `.env.local` (not `.env` or `.env.local.txt`)

## Step 3: Restart Development Server

**CRITICAL:** After creating or modifying `.env.local`, you **MUST** restart your development server:

1. **Stop the current server:**
   - Press `Ctrl + C` in the terminal where `npm run dev` is running
   - Wait until the process fully stops

2. **Start the server again:**
   ```bash
   npm run dev
   ```

3. **Wait for "Ready" message:**
   - Look for: `✓ Ready in X.Xs`
   - Don't check the browser until you see "Ready"

## Step 4: Verify API Key is Loaded

After restarting, check the browser console (F12) for any errors. The map should load without the "Map container not available" error.

## Troubleshooting

### Error: "Map container not available"
- ✅ Ensure `.env.local` exists in project root
- ✅ Verify API key is correct (no typos)
- ✅ **Restart dev server** after creating/editing `.env.local`
- ✅ Check browser console for detailed error messages

### Error: "Google Maps API key is not configured"
- ✅ Check that variable name is exactly `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- ✅ Ensure file is named `.env.local` (not `.env`)
- ✅ Restart dev server

### Map still not loading
1. Check browser console (F12) for errors
2. Verify API key is valid in [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials)
3. Ensure "Maps JavaScript API" is enabled for your project
4. Check API key restrictions allow `localhost:3000`

## File Structure

Your project structure should look like this:

```
web app working/
├── .env.local          ← Create this file here
├── package.json
├── next.config.mjs
├── app/
├── components/
└── ...
```

## Quick Checklist

- [ ] Created `.env.local` in project root
- [ ] Added `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here`
- [ ] Stopped dev server (Ctrl+C)
- [ ] Restarted dev server (`npm run dev`)
- [ ] Waited for "Ready" message
- [ ] Opened browser and tested map
