#!/bin/bash

# Initial setup script for Let's Encrypt certificates
# Run this once on your EC2 instance before starting the full docker-compose stack

set -e

domains=(degrand.is "*.degrand.is")
rsa_key_size=4096
data_path="./certbot"
email="rtdegrandis@gmail.com" # Update this with your email address
staging=0 # Set to 1 for testing, 0 for production certificates

# DNS provider for wildcard certificates (required for *.degrand.is)
# Options: route53, cloudflare, digitalocean, etc.
# Leave empty for manual DNS validation
dns_provider="route53"  # Using AWS Route53 for automated DNS validation

echo "### Preparing directories..."
mkdir -p "$data_path/conf"
mkdir -p "$data_path/www"

if [ -d "$data_path/conf/live/${domains[0]}" ]; then
  read -p "Existing certificates found for ${domains[0]}. Continue and replace them? (y/N) " decision
  if [ "$decision" != "Y" ] && [ "$decision" != "y" ]; then
    exit
  fi
fi

echo "### Downloading recommended TLS parameters..."
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"

echo "### Creating dummy certificate for ${domains[0]}..."
path="/etc/letsencrypt/live/${domains[0]}"
mkdir -p "$data_path/conf/live/${domains[0]}"
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$rsa_key_size -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo

echo "### Starting nginx..."
docker compose up --force-recreate -d nginx
echo

echo "### Deleting dummy certificate for ${domains[0]}..."
docker compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/${domains[0]} && \
  rm -Rf /etc/letsencrypt/archive/${domains[0]} && \
  rm -Rf /etc/letsencrypt/renewal/${domains[0]}.conf" certbot
echo

echo "### Requesting Let's Encrypt certificate for ${domains[*]}..."
# Join domains with -d flag
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate email arg
case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

# Enable staging mode if needed
if [ $staging != "0" ]; then staging_arg="--staging"; fi

# Wildcard certificates require DNS validation
if [ -z "$dns_provider" ]; then
  echo "###"
  echo "### IMPORTANT: Wildcard certificates require DNS validation!"
  echo "### You will need to manually add DNS TXT records when prompted."
  echo "### For automated renewal, set dns_provider variable (e.g., 'cloudflare' or 'route53')"
  echo "###"
  
  docker compose run --rm --entrypoint "\
    certbot certonly --manual --preferred-challenges dns \
      $staging_arg \
      $email_arg \
      $domain_args \
      --rsa-key-size $rsa_key_size \
      --agree-tos \
      --force-renewal" certbot
else
  echo "### Using DNS provider: $dns_provider for automated validation"
  docker compose run --rm --entrypoint "\
    certbot certonly --dns-$dns_provider \
      $staging_arg \
      $email_arg \
      $domain_args \
      --rsa-key-size $rsa_key_size \
      --agree-tos \
      --force-renewal" certbot
fi
echo

echo "### Reloading nginx..."
docker compose exec nginx nginx -s reload

echo "### Certificate setup complete!"
echo "### You can now run: docker compose up -d"
