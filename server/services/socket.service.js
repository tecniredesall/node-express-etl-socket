import os from 'os';
import Net from 'net';

import { parseDeviceMessage, parseScaleMessage, parseSorterMessage } from '../util/parsing';
import Location from '../models/location.model';
import { getScaleMetrics, getSorterMetrics, addScaleMetric, addSorterMetric, iotConnection, iotDisconnection} from './metrics.service';
export default async (io) =>  {
    const locations = await Location.find({ removed: null }).exec();
    await locations.forEach((location) => {
        const tcpServer = new Net.Server();
        tcpServer.listen(location.port, async() => {
            location.iotConnected.forEach(async(iotConnected) => iotConnected.status = 'Offline');
            await location.save();

            io.sockets.emit('iot-connections', []);
            console.info(
                `${location.name} - Socket up and running in ${
                    process.env.NODE_ENV || 'development'
                } @: ${os.hostname()} on port: ${location.port}`
            );
        });

        // When a client requests a connection with the server, the server creates a new
        // socket dedicated to that client.
        tcpServer.on('connection', async (socket) => {
            // Now that a TCP connection has been established, the server can send data to
            // the client by writing to its socket.
            socket.write(`${location.name} (${socket.remoteAddress}) - Hello, client.`);
            io.sockets.emit('iot-connections', await iotConnection(location.name, socket.remoteAddress));

            // The server can also receive data from the client by reading from its socket.
            socket.on('data', async (chunk) => {
                const message = parseDeviceMessage(chunk.toString().trim());
                console.log(`*** ${location.name} (${socket.remoteAddress}) - Data received from client: (${JSON.stringify(message,null,3)})`);

                if(typeof message === 'object') {
                    // Saving sorter's metric
                    const metric = parseSorterMessage(message, socket.remoteAddress);
                    if(metric) {
                        await addSorterMetric(location.name, metric);
                        io.to('general').to('sorter-machine').emit('metrics', await getSorterMetrics(location.name, socket.remoteAddress));
                    }
                }
                else {
                    // Saving scale's metric
                    const metric = parseScaleMessage(message, socket.remoteAddress);
                    if(metric) {
                        await addScaleMetric(location.name, metric);
                        io.to('general').to('scale').emit('metrics', await getScaleMetrics(location.name, socket.remoteAddress));
                    }
                }
            });
            // When the client requests to end the TCP connection with the server, the server
            // ends the connection.
            socket.on('end', async () => {
                console.log(`${location.name} - Closing connection with the client`);
                io.sockets.emit('iot-connections', await iotDisconnection(location.name, socket.remoteAddress));
            });
            // Don't forget to catch error, for your own sake.
            socket.on('error', function(err) {
                console.log(`Error: ${err}`);
            });
        });
    });
};
