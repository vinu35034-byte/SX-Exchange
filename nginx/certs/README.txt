# Place your Cloudflare Origin CA certificate files here.
#
# Steps to generate:
#   1. Go to Cloudflare Dashboard → nexabitexchange.pro → SSL/TLS → Origin Server
#   2. Click "Create Certificate" → keep defaults (RSA 2048, 15-year validity)
#   3. Copy the "Origin Certificate" PEM → save as  nginx/certs/origin.crt
#   4. Copy the "Private Key" PEM        → save as  nginx/certs/origin.key
#   5. Make sure your Cloudflare SSL/TLS mode is set to "Full (Strict)"
#
# ⚠️  Never commit origin.crt or origin.key to version control.
#     Both files are listed in .gitignore.
