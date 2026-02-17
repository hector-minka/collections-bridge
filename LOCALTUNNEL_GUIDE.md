# LocalTunnel Troubleshooting Guide

## Problem: Subdomain Not Working

### Issue
When trying to use `--subdomain collections`, localtunnel assigns a random subdomain instead of the requested one.

### Why This Happens

1. **Subdomain Already Taken**: The subdomain `collections` is likely already in use by another user
2. **Subdomain Reserved**: Once a subdomain is used, it may be temporarily reserved
3. **Free Tier Limitation**: LocalTunnel's free service has limited subdomain availability
4. **No Guarantee**: LocalTunnel doesn't guarantee custom subdomains on the free tier

### Solutions

#### Option 1: Use Random Subdomain (Recommended for Testing)

```bash
# Just use the random subdomain - it works fine
lt --port 3000
# or
lt --port 3001  # if your bridge runs on 3001
```

**Pros:**
- ✅ Always works
- ✅ No conflicts
- ✅ Free

**Cons:**
- ⚠️ URL changes each time you restart
- ⚠️ Need to update Payments Hub webhook URL each time

#### Option 2: Try Different Subdomain Names

Try less common subdomain names:

```bash
lt --port 3000 --subdomain collections-bridge-dev
lt --port 3000 --subdomain minka-collections-test
lt --port 3000 --subdomain collections-hector
```

#### Option 3: Use ngrok (Better for Development)

ngrok is more reliable and offers better subdomain support:

```bash
# Install ngrok
brew install ngrok
# or download from https://ngrok.com/download

# Start tunnel with custom subdomain (requires paid plan for custom subdomain)
ngrok http 3000

# Or use free tier (random subdomain, but more stable)
ngrok http 3000
```

**Pros:**
- ✅ More stable than localtunnel
- ✅ Web dashboard at http://localhost:4040
- ✅ Better SSL certificates
- ✅ Can see all requests in dashboard

**Cons:**
- ⚠️ Free tier: random subdomain (changes on restart)
- ⚠️ Paid tier needed for custom subdomain

#### Option 4: Use Cloudflare Tunnel (Free, Stable)

```bash
# Install cloudflared
brew install cloudflared

# Start tunnel
cloudflared tunnel --url http://localhost:3000
```

**Pros:**
- ✅ Free
- ✅ Very stable
- ✅ Good performance
- ✅ Persistent URLs possible

**Cons:**
- ⚠️ Requires Cloudflare account (free)
- ⚠️ Setup slightly more complex

---

## Current Setup Check

### Verify Your Bridge Port

Your bridge is configured to run on port **3000** by default (see `src/config/configuration.ts`).

**Check what port your bridge is actually running on:**

```bash
# Check if bridge is running on 3000
curl http://localhost:3000/api/v1/health

# Check if bridge is running on 3001
curl http://localhost:3001/api/v1/health
```

**If your bridge runs on 3000, use:**
```bash
lt --port 3000
```

**If your bridge runs on 3001, use:**
```bash
lt --port 3001
```

---

## Working with Random Subdomains

Since custom subdomains aren't reliable with localtunnel, here's how to work with random ones:

### 1. Start Tunnel

```bash
lt --port 3000
# Output: your url is: https://random-name-123.loca.lt
```

### 2. Update Payments Hub Webhook

Use the full URL:
```
https://random-name-123.loca.lt/api/v1/collections/webhooks/anchor-created
```

### 3. Test the Tunnel

```bash
# Test health endpoint through tunnel
curl https://random-name-123.loca.lt/api/v1/health

# Test webhook endpoint
curl -X POST https://random-name-123.loca.lt/api/v1/collections/webhooks/anchor-created \
  -H "Content-Type: application/json" \
  -d '{"event":"anchor_created","anchorHandle":"test"}'
```

### 4. Keep Tunnel Running

**Important:** Don't close the terminal where localtunnel is running. If you do:
- The tunnel URL will stop working
- You'll get a new random URL when you restart
- You'll need to update the webhook URL in Payments Hub again

---

## Connection Refused Error

If you see:
```
Error: connection refused: localtunnel.me:22445 (check your firewall settings)
```

### Causes:
1. **Bridge not running** - The local server on port 3000/3001 is not running
2. **Wrong port** - Tunnel pointing to wrong port
3. **Firewall blocking** - macOS firewall blocking connections
4. **Network issues** - Internet connectivity problems

### Solutions:

1. **Verify bridge is running:**
```bash
curl http://localhost:3000/api/v1/health
# Should return JSON response
```

2. **Check correct port:**
```bash
# See what's running on each port
lsof -i :3000
lsof -i :3001
```

3. **Check macOS Firewall:**
- System Settings → Network → Firewall
- Make sure it's not blocking Node.js

4. **Try different port:**
```bash
# If 3000 doesn't work, try 3001
lt --port 3001
```

---

## Best Practices

### For Development:

1. **Use ngrok** (most stable):
```bash
ngrok http 3000
# Check dashboard at http://localhost:4040
```

2. **Keep tunnel running** in a separate terminal window

3. **Use environment variable** for webhook URL:
```bash
export WEBHOOK_URL="https://your-tunnel-url/api/v1/collections/webhooks/anchor-created"
```

4. **Monitor both sides:**
- Bridge logs (your terminal)
- Tunnel dashboard (ngrok) or tunnel output (localtunnel)

### For Production:

- Don't use tunnels - deploy to a proper server
- Use a fixed domain with SSL
- Set up proper webhook endpoints

---

## Quick Reference

### LocalTunnel Commands

```bash
# Basic usage (random subdomain)
lt --port 3000

# Try custom subdomain (may not work)
lt --port 3000 --subdomain collections

# Specify local host explicitly
lt --port 3000 --local-host localhost
```

### ngrok Commands

```bash
# Basic usage
ngrok http 3000

# With custom domain (paid plan)
ngrok http 3000 --domain=collections.ngrok.io

# View dashboard
open http://localhost:4040
```

### Cloudflare Tunnel Commands

```bash
# Basic usage
cloudflared tunnel --url http://localhost:3000

# With custom domain (requires setup)
cloudflared tunnel --url http://localhost:3000 --hostname collections.yourdomain.com
```

---

## Troubleshooting Checklist

- [ ] Bridge is running (`curl http://localhost:3000/api/v1/health`)
- [ ] Correct port in tunnel command matches bridge port
- [ ] Tunnel shows "your url is: https://..." message
- [ ] Can access tunnel URL from browser
- [ ] Health endpoint works through tunnel
- [ ] Webhook URL is correctly configured in Payments Hub
- [ ] Full URL includes `/api/v1/collections/webhooks/anchor-created`
- [ ] Bridge logs show incoming requests
- [ ] No firewall blocking connections

---

## Recommendation

For reliable development, I recommend using **ngrok** instead of localtunnel:

1. More stable connections
2. Web dashboard to see all requests
3. Better error messages
4. More reliable SSL certificates

```bash
# Install
brew install ngrok

# Start
ngrok http 3000

# Check dashboard
open http://localhost:4040
```

The dashboard shows all requests, responses, and errors, making debugging much easier.
