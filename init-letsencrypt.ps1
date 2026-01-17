# Initial setup script for Let's Encrypt certificates
# Run this once on your EC2 instance before starting the full docker-compose stack
# PowerShell version for local testing

$domains = @("degrand.is", "*.degrand.is")
$rsa_key_size = 4096
$data_path = "./certbot"
$email = "rtdegrandis@gmail.com" # Update this with your email address
$staging = 0 # Set to 1 for testing, 0 for production certificates

# DNS provider for wildcard certificates (required for *.degrand.is)
# Options: route53, cloudflare, digitalocean, etc.
# Leave empty for manual DNS validation
$dns_provider = "route53"  # Using AWS Route53 for automated DNS validation

Write-Host "### Preparing directories..."
New-Item -ItemType Directory -Force -Path "$data_path/conf" | Out-Null
New-Item -ItemType Directory -Force -Path "$data_path/www" | Out-Null

if (Test-Path "$data_path/conf/live/$($domains[0])") {
  $decision = Read-Host "Existing certificates found for $($domains[0]). Continue and replace them? (y/N)"
  if ($decision -ne "Y" -and $decision -ne "y") {
    exit
  }
}

Write-Host "### Downloading recommended TLS parameters..."
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf" -OutFile "$data_path/conf/options-ssl-nginx.conf"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem" -OutFile "$data_path/conf/ssl-dhparams.pem"

Write-Host "### Creating dummy certificate for $($domains[0])..."
$path = "/etc/letsencrypt/live/$($domains[0])"
New-Item -ItemType Directory -Force -Path "$data_path/conf/live/$($domains[0])" | Out-Null
docker compose run --rm --entrypoint "openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1 -keyout '$path/privkey.pem' -out '$path/fullchain.pem' -subj '/CN=localhost'" certbot

Write-Host "### Starting nginx..."
docker compose up --force-recreate -d nginx

Write-Host "### Deleting dummy certificate for $($domains[0])..."
docker compose run --rm --entrypoint "rm -Rf /etc/letsencrypt/live/$($domains[0]) && rm -Rf /etc/letsencrypt/archive/$($domains[0]) && rm -Rf /etc/letsencrypt/renewal/$($domains[0]).conf" certbot

Write-Host "### Requesting Let's Encrypt certificate for $($domains -join ', ')..."
# Join domains with -d flag
$domain_args = ""
foreach ($domain in $domains) {
  $domain_args += " -d $domain"
}

# Select appropriate email arg
if ($email -eq "") {
  $email_arg = "--register-unsafely-without-email"
} else {
  $email_arg = "--email $email"
}

# Enable staging mode if needed
$staging_arg = ""
if ($staging -ne 0) {
  $staging_arg = "--staging"
}

# Wildcard certificates require DNS validation
if ($dns_provider -eq "") {
  Write-Host "###"
  Write-Host "### IMPORTANT: Wildcard certificates require DNS validation!"
  Write-Host "### You will need to manually add DNS TXT records when prompted."
  Write-Host "### For automated renewal, set dns_provider variable (e.g., 'cloudflare' or 'route53')"
  Write-Host "###"
  
  docker compose run --rm --entrypoint "certbot certonly --manual --preferred-challenges dns $staging_arg $email_arg $domain_args --rsa-key-size $rsa_key_size --agree-tos --force-renewal" certbot
} else {
  Write-Host "### Using DNS provider: $dns_provider for automated validation"
  docker compose run --rm --entrypoint "certbot certonly --dns-$dns_provider $staging_arg $email_arg $domain_args --rsa-key-size $rsa_key_size --agree-tos --force-renewal" certbot
}

Write-Host "### Reloading nginx..."
docker compose exec nginx nginx -s reload

Write-Host "### Certificate setup complete!"
Write-Host "### You can now run: docker compose up -d"
