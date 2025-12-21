#!/bin/sh
# Script de inicialização que configura a porta dinamicamente

PORT=${PORT:-80}

cat > /etc/nginx/conf.d/default.conf << EOF
server {
    listen ${PORT};
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

echo "Nginx starting on port ${PORT}"
nginx -g 'daemon off;'

