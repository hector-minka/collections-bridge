# Tunnel Troubleshooting Guide

This guide helps diagnose and fix issues when using local tunnels (ngrok, localtunnel, etc.) to expose the Collections Bridge to the Payments Hub.

## Common Issues with Local Tunnels

### 1. **Connection Timeouts**

**Symptoms:**
- Ledger logs show timeout errors
- Webhooks never reach the bridge
- Requests fail with `ECONNRESET` or `ETIMEDOUT`

**Possible Causes:**
- Tunnel service is down or unstable
- Network connectivity issues
- Firewall blocking connections
- Tunnel URL not properly configured in Payments Hub

**Solutions:**
- Verify tunnel is running: `curl https://your-tunnel-url.ngrok.io/api/v1/health`
- Check tunnel logs for connection issues
- Try a different tunnel service (ngrok, localtunnel, cloudflared)
- Ensure tunnel URL is correctly configured in Payments Hub webhook settings
- Check if your local server is actually running and accessible

---

### 2. **SSL/TLS Certificate Issues**

**Symptoms:**
- Ledger logs show SSL handshake errors
- `CERT_HAS_EXPIRED` or `UNABLE_TO_VERIFY_LEAF_SIGNATURE` errors
- Connection refused errors

**Solutions:**
- Ensure tunnel URL uses HTTPS (most tunnel services provide this)
- Verify the tunnel certificate is valid
- Some tunnel services have self-signed certificates - check if Payments Hub accepts them
- Try using a paid tunnel service with proper SSL certificates

---

### 3. **Request Body Not Received**

**Symptoms:**
- Bridge receives requests but body is empty or undefined
- Logs show `{}` or `null` for request body
- Validation errors for missing required fields

**Possible Causes:**
- Body parser not configured correctly
- Content-Type header mismatch
- Request size limits exceeded
- Tunnel stripping request body

**Solutions:**
- Check Content-Type header in logs (should be `application/json`)
- Verify body parser limits in `main.ts` (currently set to 50mb)
- Check tunnel service request size limits
- Add logging to see raw request body before parsing

---

### 4. **Headers Missing or Modified**

**Symptoms:**
- Authentication headers missing
- Custom headers not received
- CORS errors

**Possible Causes:**
- Tunnel service stripping headers
- Headers too large
- Case sensitivity issues

**Solutions:**
- Check all headers in bridge logs (we log all headers)
- Verify Payments Hub is sending expected headers
- Some tunnel services have header size limits
- Check if tunnel modifies or removes headers

---

### 5. **CORS Issues**

**Symptoms:**
- Browser console shows CORS errors
- Preflight requests failing
- `Access-Control-Allow-Origin` errors

**Solutions:**
- Current CORS is set to `*` (allow all) - should work
- Verify CORS configuration in `main.ts`
- Check if tunnel adds additional CORS restrictions
- Ensure `credentials: true` is set if using cookies/auth

---

### 6. **Request Timeout from Ledger**

**Symptoms:**
- Ledger logs show timeout after 15-30 seconds
- Bridge receives request but takes too long to respond
- Ledger retries the webhook

**Solutions:**
- Check bridge response time in logs
- Optimize database queries
- Check ledger timeout configuration (`MINKA_LEDGER_TIMEOUT`)
- Ensure bridge responds quickly (webhooks should be fast)
- Consider async processing for heavy operations

---

## Debugging Steps

### Step 1: Verify Bridge is Receiving Requests

Check your bridge logs for:
```
=== INCOMING REQUEST: anchor_created webhook ===
```

If you don't see this log, the request is not reaching your bridge.

**Check:**
- Is the bridge running?
- Is the tunnel active?
- Is the URL correct in Payments Hub?
- Check tunnel dashboard for incoming requests

---

### Step 2: Check Request Details

When a request arrives, you should see:
- Method (should be POST)
- URL (should match endpoint)
- Headers (all headers from Payments Hub)
- Body (complete request payload)

**If body is empty:**
- Check Content-Type header
- Verify body parser configuration
- Check tunnel service logs

---

### Step 3: Verify Response

The bridge should respond with:
- Status 200 OK
- Valid JSON response
- Response time < 5 seconds

**Check bridge logs for:**
- Any errors during processing
- Response being sent
- Processing time

---

### Step 4: Check Ledger Logs

In Google Cloud Logs, look for:
- Webhook delivery attempts
- Response status codes
- Error messages
- Retry attempts

**Common errors in ledger logs:**
- `ECONNREFUSED`: Bridge not reachable
- `ETIMEDOUT`: Request timeout
- `400 Bad Request`: Invalid request format
- `500 Internal Server Error`: Bridge error

---

## Testing Your Tunnel

### 1. Test Health Endpoint

```bash
curl https://your-tunnel-url.ngrok.io/api/v1/health
```

Should return:
```json
{
  "status": "ok",
  "info": {...},
  "error": {},
  "details": {...}
}
```

### 2. Test Webhook Endpoint Manually

```bash
curl -X POST https://your-tunnel-url.ngrok.io/api/v1/collections/webhooks/anchor-created \
  -H "Content-Type: application/json" \
  -d '{
    "event": "anchor_created",
    "anchorHandle": "anchor:test-123",
    "anchorData": {
      "data": {
        "handle": "anchor:test-123",
        "schema": "qr-code",
        "custom": {
          "metadata": {
            "merchantTxId": "test-tx-123"
          }
        }
      }
    }
  }'
```

Check your bridge logs - you should see the full request logged.

### 3. Check Tunnel Status

**For ngrok:**
```bash
curl http://localhost:4040/api/tunnels
```

**For localtunnel:**
Check the tunnel URL in your terminal

---

## Recommended Tunnel Services

### 1. **ngrok** (Recommended)
- ✅ Stable and reliable
- ✅ HTTPS by default
- ✅ Good for development
- ✅ Web dashboard for monitoring
- ⚠️ Free tier has limitations

**Setup:**
```bash
ngrok http 3000
```

### 2. **localtunnel**
- ✅ Free and open source
- ✅ Simple setup
- ⚠️ Can be unstable
- ⚠️ URLs change on restart

**Setup:**
```bash
npx localtunnel --port 3000
```

### 3. **cloudflared** (Cloudflare Tunnel)
- ✅ Free
- ✅ Very stable
- ✅ Good performance
- ⚠️ Requires Cloudflare account

**Setup:**
```bash
cloudflared tunnel --url http://localhost:3000
```

---

## Configuration Checklist

- [ ] Bridge is running on localhost:3000 (or configured port)
- [ ] Tunnel is active and showing as "online"
- [ ] Tunnel URL is HTTPS (required for webhooks)
- [ ] Tunnel URL is configured in Payments Hub webhook settings
- [ ] Webhook endpoint path is correct: `/api/v1/collections/webhooks/anchor-created`
- [ ] Full URL in Payments Hub: `https://your-tunnel.ngrok.io/api/v1/collections/webhooks/anchor-created`
- [ ] Bridge logs show incoming requests
- [ ] No firewall blocking tunnel connections
- [ ] Request body size is within limits (50mb configured)

---

## What to Check in Ledger Logs

When investigating errors in Google Cloud Logs:

1. **Look for webhook delivery attempts:**
   - Search for your bridge URL or tunnel domain
   - Check for HTTP status codes
   - Look for error messages

2. **Check request/response details:**
   - Request payload sent
   - Response received (if any)
   - Error stack traces

3. **Verify timing:**
   - When was the webhook sent?
   - How long did it take?
   - Was it retried?

4. **Check for specific errors:**
   - Connection refused
   - Timeout errors
   - SSL errors
   - 400/500 status codes

---

## Quick Diagnostic Commands

### Check if bridge is running:
```bash
curl http://localhost:3000/api/v1/health
```

### Check tunnel is forwarding:
```bash
curl https://your-tunnel-url/api/v1/health
```

### Monitor bridge logs in real-time:
```bash
# If using npm
npm run start:dev

# If using Docker
docker-compose logs -f app
```

### Test webhook endpoint directly:
```bash
curl -X POST http://localhost:3000/api/v1/collections/webhooks/anchor-created \
  -H "Content-Type: application/json" \
  -d '{"event":"anchor_created","anchorHandle":"test"}'
```

---

## Common Error Messages and Solutions

### "Connection refused"
- **Cause**: Bridge not running or wrong port
- **Solution**: Start bridge, verify port 3000 is correct

### "Request timeout"
- **Cause**: Bridge taking too long to respond
- **Solution**: Check bridge logs, optimize slow operations

### "SSL handshake failed"
- **Cause**: Certificate issues with tunnel
- **Solution**: Use tunnel service with valid SSL certificates

### "404 Not Found"
- **Cause**: Wrong URL path in Payments Hub
- **Solution**: Verify full path: `/api/v1/collections/webhooks/anchor-created`

### "400 Bad Request"
- **Cause**: Invalid request body format
- **Solution**: Check bridge logs for body content, verify DTO validation

### "500 Internal Server Error"
- **Cause**: Bridge error during processing
- **Solution**: Check bridge logs for error stack traces

---

## Best Practices

1. **Use ngrok for development** - Most stable option
2. **Monitor tunnel dashboard** - See all incoming requests
3. **Check bridge logs first** - They show exactly what's received
4. **Test manually first** - Use curl to verify endpoint works
5. **Keep tunnel URL updated** - Update Payments Hub when tunnel restarts
6. **Use persistent URLs** - ngrok paid plans offer fixed URLs
7. **Monitor both sides** - Check both bridge and ledger logs

---

## Getting Help

If issues persist:

1. **Collect logs:**
   - Bridge logs (full request/response)
   - Tunnel service logs
   - Ledger logs from Google Cloud

2. **Document:**
   - Tunnel service used
   - Tunnel URL
   - Exact error messages
   - Timestamp of errors

3. **Verify:**
   - Bridge receives requests (check logs)
   - Request format is correct
   - Response is sent successfully

---

## Additional Resources

- [ngrok Documentation](https://ngrok.com/docs)
- [localtunnel GitHub](https://github.com/localtunnel/localtunnel)
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
