# VPN Troubleshooting Guide

## Issue: Sonarr/Radarr not connecting through WireGuard VPN

Since qBittorrent works but Sonarr/Radarr don't, this suggests a VPN routing or service configuration issue.

## Common VPN Issues

### 1. **Port Accessibility**
- **qBittorrent** typically uses port 8080 (HTTP) or 8081 (HTTPS)
- **Sonarr** typically uses port 8989
- **Radarr** typically uses port 7878

**Check:** Are all these ports accessible through your VPN?

### 2. **Service Binding**
- Services might be bound to localhost (127.0.0.1) instead of all interfaces (0.0.0.0)
- This prevents external access even through VPN

**Check Sonarr/Radarr settings:**
- Go to Settings → General
- Look for "Bind Address" or "Host"
- Should be `*` or `0.0.0.0`, not `127.0.0.1` or `localhost`

### 3. **Firewall Rules**
- VPN might be routing traffic differently
- Firewall might block certain ports for VPN traffic

**Check:** Test ports directly:
```bash
# From your VPN client machine
telnet YOUR_SERVER_IP 8989  # Sonarr
telnet YOUR_SERVER_IP 7878  # Radarr
telnet YOUR_SERVER_IP 8080  # qBittorrent
```

### 4. **DNS Resolution**
- VPN might not be resolving internal hostnames correctly
- Try using IP addresses instead of hostnames

**Test:** Use `http://192.168.x.x:8989` instead of `http://hostname:8989`

### 5. **API Key Issues**
- Sonarr/Radarr might require API keys
- Check if API key is configured correctly

**Check:** Look in Sonarr/Radarr settings for API key

## Debugging Steps

### Step 1: Test Basic Connectivity
```bash
# Test if ports are open
nmap -p 8989,7878,8080 YOUR_SERVER_IP

# Test HTTP connectivity
curl -v http://YOUR_SERVER_IP:8989/api/v3/system/status
curl -v http://YOUR_SERVER_IP:7878/api/v3/system/status
```

### Step 2: Check Service Logs
Look at Sonarr/Radarr logs for connection attempts:
- Sonarr: Check logs for incoming requests
- Radarr: Check logs for incoming requests

### Step 3: Test with Browser
Try accessing the services directly in your browser:
- `http://YOUR_SERVER_IP:8989` (Sonarr)
- `http://YOUR_SERVER_IP:7878` (Radarr)

### Step 4: Check VPN Configuration
- Ensure VPN is routing traffic to the correct subnet
- Check if VPN client can reach the server's internal IP
- Verify WireGuard configuration includes the correct routes

## Quick Fixes to Try

### 1. **Use IP Address Instead of Hostname**
Instead of: `http://server.local:8989`
Use: `http://192.168.1.100:8989`

### 2. **Check Service Binding**
In Sonarr/Radarr settings:
- Bind Address: `*` or `0.0.0.0`
- Port: `8989` (Sonarr) or `7878` (Radarr)

### 3. **Disable Authentication Temporarily**
For testing, temporarily disable authentication in Sonarr/Radarr to rule out API key issues.

### 4. **Check Firewall**
```bash
# On the server
sudo ufw status
sudo iptables -L

# Allow ports through firewall
sudo ufw allow 8989
sudo ufw allow 7878
```

### 5. **Test with curl**
```bash
# Test Sonarr
curl -H "X-Api-Key: YOUR_API_KEY" http://YOUR_SERVER_IP:8989/api/v3/system/status

# Test Radarr  
curl -H "X-Api-Key: YOUR_API_KEY" http://YOUR_SERVER_IP:7878/api/v3/system/status
```

## Expected Console Output

With the debugging enabled, you should see:

```
🌐 [BaseConnector] Testing basic network connectivity...
🌐 [NetworkTest] Testing connectivity to: http://YOUR_SERVER_IP:8989
🌐 [NetworkTest] Response received: { status: 200, ... }
🔧 [SonarrConnector] Getting version from: http://YOUR_SERVER_IP:8989/api/v3/system/status
```

If you see network errors, the issue is VPN-related.
If you see authentication errors, the issue is API key related.
If you see service errors, the issue is service configuration.

## Next Steps

1. Run the app with debugging enabled
2. Check the console logs for the specific error
3. Follow the appropriate troubleshooting steps above
4. Test the fixes one by one