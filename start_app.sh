echo "Starting rabbitmq"
rabbitmq-server &
sleep 5

echo "Starting chat server"
node ./server.js 8081 &
node ./server.js 8082 &
sleep 5

echo "Starting haproxy"
haproxy -f haproxy.conf