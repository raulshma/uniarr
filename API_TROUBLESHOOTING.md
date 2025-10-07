# API Authentication Troubleshooting Guide

## Your Situation
- ✅ qBittorrent works (connects successfully)
- ❌ Sonarr/Radarr don't work (test and save do nothing)
- ✅ URLs work in browser through VPN
- 🔧 Using WireGuard VPN

## Root Cause Analysis

Since the URLs work in the browser but the app doesn't connect, this is likely an **API authentication issue**.

## Common API Issues

### 1. **Missing or Incorrect API Keys**

**Sonarr API Key:**
- Go to Sonarr → Settings → General → Security → API Key
- Copy the entire 32-character key
- Make sure there are no extra spaces or characters

**Radarr API Key:**
- Go to Radarr → Settings → General → Security → API Key  
- Copy the entire 32-character key
- Make sure there are no extra spaces or characters

### 2. **API Key Format Issues**

Common problems:
- API key has leading/trailing spaces
- API key is truncated (not full 32 characters)
- API key contains line breaks
- Wrong API key copied (from wrong service)

### 3. **Authentication Method Issues**

Sonarr/Radarr use different authentication methods:
- **API Key in Header**: `X-Api-Key: your-api-key`
- **API Key in Query**: `?apikey=your-api-key`

The app tries both methods automatically.

## Debugging Steps

### Step 1: Check API Key Format
The enhanced debugging will now validate your API key format and show:
```
🔑 API key validation: { isValid: true/false, message: "...", suggestions: [...] }
```

### Step 2: Test API Endpoints Directly
Use these curl commands to test your API keys:

**Test Sonarr:**
```bash
curl -H "X-Api-Key: YOUR_SONARR_API_KEY" \
     http://YOUR_SERVER_IP:8989/api/v3/system/status
```

**Test Radarr:**
```bash
curl -H "X-Api-Key: YOUR_RADARR_API_KEY" \
     http://YOUR_SERVER_IP:7878/api/v3/system/status
```

### Step 3: Check Service Logs
Look at Sonarr/Radarr logs for incoming requests:
- Sonarr: Check logs for API requests
- Radarr: Check logs for API requests

### Step 4: Verify API Key in Browser
1. Open Sonarr/Radarr in browser
2. Go to Settings → General → Security
3. Copy the API key exactly as shown
4. Paste it into the app

## Enhanced Debugging Output

With the new debugging, you'll see:

```
🧪 [ApiTest] Testing endpoint: http://YOUR_SERVER_IP:8989/api/v3/system/status
🧪 [ApiTest] API Key provided: Yes
🧪 [ApiTest] Testing with X-Api-Key header...
✅ [ApiTest] X-Api-Key header worked: { status: 200, dataType: 'object', hasData: true }
```

Or if it fails:
```
❌ [ApiTest] X-Api-Key header failed: { status: 401, message: 'Unauthorized' }
```

## Quick Fixes to Try

### 1. **Regenerate API Keys**
- Go to Sonarr/Radarr settings
- Disable API key temporarily
- Save settings
- Re-enable API key
- Copy the new key

### 2. **Check API Key Length**
- Sonarr/Radarr API keys should be exactly 32 characters
- If shorter, you might have copied it incorrectly

### 3. **Test Without Authentication**
- Temporarily disable authentication in Sonarr/Radarr
- Test if the app can connect
- If it works, the issue is definitely the API key

### 4. **Check Service Settings**
- Make sure API is enabled in Sonarr/Radarr
- Check if there are any IP restrictions
- Verify the service is running

## Expected Console Output

**Successful connection:**
```
🔑 API key validation: { isValid: true, message: 'API key format looks correct' }
🧪 [ApiTest] Testing endpoint: http://YOUR_SERVER_IP:8989/api/v3/system/status
✅ [ApiTest] X-Api-Key header worked: { status: 200, ... }
🔧 [SonarrConnector] Getting version from: http://YOUR_SERVER_IP:8989/api/v3/system/status
✅ [SonarrConnector] Version retrieved: 4.0.0
```

**Failed connection:**
```
🔑 API key validation: { isValid: false, message: 'API key should be 32 characters long' }
❌ API key validation failed: API key should be 32 characters long
```

## Next Steps

1. **Run the app** with enhanced debugging
2. **Check the console logs** for API key validation results
3. **Look for specific error messages** about authentication
4. **Test your API keys** with the curl commands above
5. **Regenerate API keys** if needed

The enhanced debugging will now show you exactly what's wrong with the API authentication and guide you to the solution.