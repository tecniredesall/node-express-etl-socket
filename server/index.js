import os from 'os';
import fs from 'fs';
import express from 'express';
import http from 'http';
import portscanner from 'portscanner';
import net from 'net';

import connectDB from './util/db-connection-helper';
import {
    getScaleMetrics,
    getSorterMetrics,
    getConnections,
    getDevicesList,
    getDeviceType,
    iotConnection,
    iotDisconnection
} from './services/metrics.service';
import { parseSorterMessage } from './util/parsing';
import socketServices from './services/socket.service';

var clients = [];

if (fs.existsSync(__dirname, '../.env')) require('dotenv').config();

connectDB().then(async () => {

    // Websocket server
    const server = http.Server(express());
    const io = require('socket.io')(server, {
        cors: {
            origin: "*"
        }
    });

    // Websocket server logic
    io.on('connection', (webSocket) => {
        console.log('WS - Un cliente se ha conectado');
        clients.push({
            'room': 'general',
            'socket': webSocket.id
        });
        //console.log(clients);
        webSocket.join('general');
        webSocket.on("filter", (room) => {
            let index = clients.findIndex((c) => c.socket === webSocket.id);
            webSocket.leave(clients[index].room);
            webSocket.join(room);
            clients[index].room = room;
            //console.log(io.sockets.adapter.rooms);
            console.log("change room");
        });
        // Get metrics
        webSocket.on("filtered-metrics", async ({ location, deviceIPAddress: ip_address = null }) => {
            let deviceType = null;
            if (ip_address) deviceType = await getDeviceType(location, ip_address);
            deviceType == 'sorter-machine'
                ? webSocket.emit('metrics', await getSorterMetrics(location, ip_address))
                : webSocket.emit('metrics', await getScaleMetrics(location, ip_address));
        })

        // returns a connected clients list
        webSocket.on("pool-iot-connections", async ({ location }) => {
            webSocket.emit('iot-connections', await getConnections(location));
        })

        // returns a connected clients list
        webSocket.on("pool-iot-list", async ({ location }) => {
            webSocket.emit('iot-list', await getDevicesList(location));
        })

        // check if a client is connected
        webSocket.on("is-ip-connected", async ({ location, ip_address }) => {
            webSocket.emit('ip-status', await getConnections(location, ip_address) ? 'online' : 'offline');
        })

        // Check if a device port is running
        webSocket.on("check-device-status", async ({ location, ip_address, port }) => {
            console.log("status", ip_address, port);
            await portscanner.checkPortStatus(port, ip_address) == 'open'
                ? await iotConnection(location, `::ffff:${ip_address}`, 'sorter-machine')
                : await iotDisconnection(location, `::ffff:${ip_address}`);


            let dev_status = await getConnections(location, `::ffff:${ip_address}`) ? 'online' : 'offline';
            if (dev_status == "offline") {
                var client = new net.Socket();
                client.setTimeout(900);
                client.connect(port, ip_address, async () => {
                    client.write('{"code":600}');
                });
                client.on('data', async (data) => {
                    sendStatusIp(webSocket,"online")
                    client.destroy();
                });
                eventsSockectDevice(webSocket, client);

            } else {
                webSocket.emit('device-status', dev_status);
            }

        })

        // Sending messages to sorter machine
        webSocket.on("send-device-request", async ({ location, ip_address, port, process_id }) => {
            var client = new net.Socket();
            client.setTimeout(900);
            console.log(port, ip_address);
            client.connect(port, ip_address, async () => {
                client.write('{"code":600}');
            });
            client.on('data', async (data) => {
                const metric = parseSorterMessage(JSON.parse(data.toString().trim()), ip_address);
                if (metric) {
                    let metricstrf = [{
                        "total": metric['total'],
                        "bad": metric['bad'],
                        "speed": metric['speed'],
                        "ImpurityRatio": metric['ImpurityRatio'],
                        "DefectiveRatio": metric['DefectiveRatio'],
                        "date": metric['date'],
                        "device_type": 'sorter-machine',
                        "ip_address": ip_address,
                    }];
                    console.log("Machine-> ", metricstrf);
                    //sendStatusIp(webSocket,"online") Para evitar que se saturen las peticiones en front, solo es necesario al iniciar la conexión (is-ip-conected) (check-device-status)
                    webSocket.emit('metrics', metricstrf);
                }
                client.destroy();
            });

            eventsSockectDevice(webSocket, client);
        })

        // Gettin' the whole set of metrics from sorter machine
        webSocket.on("get-device-real-metrics", async ({ location, ip_address, process_id }) => {
            webSocket.emit('real-device-metrics', await getSorterMetrics(location, ip_address, process_id, true));
        })

        webSocket.on('disconnect', function(){
            let index = clients.findIndex((c) => c.socket === webSocket.id);
            let tmp_client = clients[index];
            console.log("Cliente desconectado: " + webSocket.id);
            clients.splice(index,1);
        })
    });

    socketServices(io);
    server.listen(process.env.WS_PORT, function () {
        console.info(
            `Websocket up and running in ${process.env.NODE_ENV || 'development'
            } @: ${os.hostname()} on port: ${process.env.WS_PORT}`
        );
    });


    function sendStatusIp(webSocket,status)
    {
        webSocket.emit('ip-status', status);
        webSocket.emit('device-status', status);
    }


    function eventsSockectDevice(webSocket, client)
    {
        let status = "online";
        let destroy = () => {
            try {
                client.end();
            } catch (error) {
            }
            try {
                client.destroy();
            } catch (error) {

            }
        }

        client.on('end', async () => {
            destroy()
        });

        client.on('error', async () => {
            status="offline";
            sendStatusIp(webSocket,status);
            destroy()
        });

        client.on('timeout', () => {
            status="offline";
            sendStatusIp(webSocket,status);
            destroy()
        });

        client.on('close', async () => {
            try {
            } catch (error) {
            }
        });

    }




});



// let json= {
//     "removed": null,
//     "name": "Capucas",
//     "port": 9898,
//     "registered": {
//       "$date": {
//         "$numberLong": "1625511747326"
//       }
//     },
//     "iotConnected": [
//       {
//         "status": "Offline",
//         "device_type": "scale",
//         "_id": {
//           "$oid": "618aa36cefb4ab9c237b2523"
//         },
//         "ip_address": "::ffff:192.168.88.118"
//       }
//     ]
//   }