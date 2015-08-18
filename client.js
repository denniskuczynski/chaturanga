(function() {

    var connection;

    function createConnection() {
        connection = new WebSocket('ws://dennismac:8080');
        connection.onopen = function () {
            console.log('onopen', arguments);
            bindFormListener();
        };

        connection.onerror = function () {
            console.log('onerror', arguments);
            unbindFormListener();
        };

        connection.onclose = function () {
            console.log('onclose', arguments);
            clearMessages();
            setTimeout(createConnection, 5000);
        };

        connection.onmessage = function (message) {
            console.log('onmessage', arguments);
            var msg = JSON.parse(message.data);
            if (msg.type === 'history') {
                msg.data.forEach(appendMessage);
            } else {
                appendMessage(msg);
            }
        };
    }

    function bindFormListener() {
        var form = document.getElementById('input_form');
        form.submit.disabled = false;
        form.addEventListener('submit', function(e) {
            e.preventDefault();

            var form = e.target;
            connection.send(form.message.value);
            form['message'].value = '';
            form['message'].focus();
        });
    }

    function unbindFormListener() {
        var form = document.getElementById('input_form');
        form.submit.disabled = true;
        form.removeEventListener('submit');
    }

    function appendMessage(message) {
        var data = message.data;
        var messages = document.getElementById('messages');
        var li = document.createElement('li');
        li.appendChild(
            document.createTextNode(new Date(data.time)+' -- '+data.text)
        );
        if (messages.children && messages.children.length) {
            messages.insertBefore(li, messages.children[0]);
        } else {
            messages.appendChild(li);
        }
    }

    function clearMessages() {
        document.getElementById('messages').innerHTML = null;
    }

    document.addEventListener('DOMContentLoaded', function(event) {
        createConnection();
    });
})();
