"use strict";

var webSocketServer = require('websocket').server;
var node_static = require('node-static');
var http = require('http');
var amqp = require('amqplib');

var port = process.argv[2];
var history = [ ];
var clients = [ ];


// Setup file and websocket server
var file = new node_static.Server();
var server = http.createServer(function(req, res) {
    // serve static files
    file.serve(req, res);
});
server.listen(port, function() {
    console.log((new Date()) + " chat server is listening on port %s", port);
});
var wsServer = new webSocketServer({
    httpServer: server
});


// Setup amqp channel and setup a function to publish chat messages
var publishMessage;
var onReceiveMessage = function onReceiveMessage(msg) {
    var content = msg.content.toString();
    console.log(port + " received '%s'", content);

    // we want to keep history of last 100 sent messages
    history.push(JSON.parse(content));
    history = history.slice(-100);

    for (var i=0; i < clients.length; i++) {
        console.log(port + " sending to client", i);
        clients[i].sendUTF(content, function(err) {
            if (err) {
                console.error('error sending to client', err);
                console.error(clients[i]);
            }
        });
    }
}
amqp.connect('amqp://localhost').then(function(connection) {
    process.once('SIGINT', function() { connection.close(); });
    return connection.createChannel().then(function(channel) {
        var exchange = 'chatroom';
        publishMessage = function(message) {
            channel.publish(exchange, '', new Buffer(message));
            console.log(port + " sent '%s'", message);
        }

        // setup promise chain for establishing exchange
        return channel.assertExchange(exchange, 'fanout', { durable: false })
            .then(function() {
                return channel.assertQueue('', { exclusive: true });
            }).then(function(qok) {
                return channel.bindQueue(qok.queue, exchange, '').then(function() {
                    return qok.queue;
                });
            }).then(function(queue) {
                return channel.consume(queue, onReceiveMessage, { noAck: true });
            }).then(function() {
                console.log('Waiting for chatroom. To exit press CTRL+C');
            });
  });
}).then(null, function onError(error) {
    console.warn('Error establishing smqp connection', error);
});


// Setup handler for websocket connections
wsServer.on('request', function(request) {
    console.log((new Date()) + ' Connection from origin %s.', request.origin);

    var connection = request.accept(null, request.origin);
    var index = clients.push(connection) - 1;

    console.log(port + ' connection created at ', index);

    // send back chat history
    if (history.length > 0) {
        connection.sendUTF(JSON.stringify({ type: 'history', data: history }));
    }

    // user sent some message
    connection.on('message', function(message) {
        if (message.type === 'utf8') { // accept only text
            console.log((new Date()) + ' ' + port + ' Received Message: ' + message.utf8Data);

            var obj = {
                time: (new Date()).getTime(),
                text: message.utf8Data
            };

            // broadcast message to all connected clients
            var json = JSON.stringify({ type: 'message', data: obj });
            publishMessage(json);
        }
    });

    // user disconnected
    connection.on('close', function(connection) {
        console.log((new Date()) + " Peer " + connection.remoteAddress + " disconnected.");
        console.log(port + ' connection removed at ', index);
        clients.splice(index, 1);
    });
});
