import 'babel-polyfill';
import Location from '../models/location.model';
import Scale from '../models/scale.model';
import Sorter from '../models/sorter.model';

export const getScaleMetrics = async(name, ip_address = null) => {
    const locationObj = await Location.findOne({ name });
    if(locationObj) {
        let $match = {location: locationObj._id}
        if(ip_address) $match['ip_address'] = ip_address;
        let results = await Scale.aggregate([
            {$match},
            {$project: {
                _id: 0,
                ip_address: 1,
                metrics: { $slice: ["$metrics", -1 ] }
            }},
            {$project: {
                "metrics.device_type": "scale",
                "metrics.ip_address":"$ip_address",
                "metrics.weight": 1,
                "metrics.units": 1,
                "metrics.date": 1,
            }},
        ]);

        results = results.length
            ? results[0]
            : {'metrics': []};
        const { metrics } = results;
        //console.info('getScaleMetrics', metrics);
        
        console.info('getScaleMetrics', ' - ', new Date().toLocaleString());
        return metrics;
    }
    else {
        console.info('getScaleMetrics', ' - ', new Date().toLocaleString());
        return {'metrics': []}
    }
}

export const getSorterMetrics = async(name, ip_address = null, process_id = null, realMetrics = false) => {
    const locationObj = await Location.findOne({ name });
    if(locationObj) {
        let $match = {location: locationObj._id}
        if(ip_address) $match['ip_address'] = ip_address;
        if(process_id) $match['process_id'] = process_id;
        let results = await Sorter.aggregate([
            {$match},
            {$project: {
                _id: 0,
                ip_address: 1,
                metrics: 1
            }},
            {$project: {
                "metrics.device_type": "sorter-machine",
                "metrics.ip_address":"$ip_address",
                "metrics.total": 1,
                "metrics.bad": 1,
                "metrics.speed": 1,
                "metrics.ImpurityRatio": 1,
                "metrics.DefectiveRatio": 1,
                "metrics.periodProduct": 1,
                "metrics.date": 1,
            }},
        ]);

        let metrics = [];
        if(realMetrics && results.length > 0) return results[0]['metrics'];
        if(results.length > 0 && results[0]['metrics'].length > 1) {
            const firstMetric = results[0]['metrics'][0];
            const lastMetric = results[0]['metrics'][1];

            metrics = [{
                "total" : lastMetric['total'] - firstMetric['total'],
                "bad" : lastMetric['bad'] - firstMetric['bad'],
                "ImpurityRatio" : lastMetric['ImpurityRatio'],
                "DefectiveRatio" : lastMetric['DefectiveRatio'],
                "date" : lastMetric['date'],
                "device_type" : lastMetric['device_type'],
                "ip_address" : lastMetric['ip_address'],
            }];
        }

        return metrics;
    }
    else {
        return {'metrics': []}
    }
}

export const addScaleMetric = async(location, metric) => {
    const locationObj = await Location.findOne({ name: location });
    if(locationObj) {
        let { weight, units, date } = metric;
        units = units ? units: 'lb';
        console.info('addScaleMetric', new Date().toLocaleString(), ' - ', Object.assign({ip_address: metric['ip_address']}, { weight, units, date }));

        let scale = await Scale.findOne({
            location: locationObj._id,
            ip_address: metric['ip_address'] 
        });
        if(!scale) {
            await new Scale({
                location: locationObj._id,
                ip_address: metric['ip_address'],
                metrics: [{ weight, units, date }]
            }).save();
        }
        else {
            let lastMetric = scale.metrics[scale.metrics.length - 1];
            if(!isObjectEqual({ weight, units }, { weight: lastMetric.weight.toString(), units: lastMetric.units })) {
                await Scale.updateOne(
                    {
                        location: locationObj._id,
                        ip_address: metric['ip_address'] 
                    }, 
                    { $push: { metrics: [{ weight, units, date }] } }
                );

                scale = await Scale.findOne({
                    location: locationObj._id,
                    ip_address: metric['ip_address'] 
                });

                if(scale.metrics.length > process.env.MAX_METRICS_PER_SCALE || 50) {
                    await Scale.updateOne(
                        {
                            location: locationObj._id,
                            ip_address: metric['ip_address'] 
                        }, 
                        { $set: { metrics: scale.metrics.slice(-process.env.MAX_METRICS_PER_SCALE || 50) } }
                    );
                }
            }
        }
    }
    else{
        console.warn('Undefined scale');
    }
}

export const addSorterMetric = async(location, metric, process_id = null) => {
    const locationObj = await Location.findOne({ name: location });
    if(locationObj) {
        const { total, bad, speed, ImpurityRatio, DefectiveRatio, periodProduct, date } = metric;
        console.info('addSorterMetric', Object.assign({ip_address: metric['ip_address']}, { total, bad, speed, ImpurityRatio, DefectiveRatio, periodProduct, date }));

        let sorter = await Sorter.findOne({
            location: locationObj._id,
            process_id: process_id,
            ip_address: metric['ip_address']
        }).lean();
        if(!sorter) {
            await new Sorter({
                location: locationObj._id,
                ip_address: metric['ip_address'],
                process_id: process_id,
                metrics: [{ total, bad, speed, ImpurityRatio, DefectiveRatio, periodProduct, date }]
            }).save();
        }
        else {
            let firstMetric = sorter.metrics[0];
            let lastMetric = sorter.metrics[sorter.metrics.length - 1];
            if(!lastMetric || !isObjectEqual(
                { total, bad, speed, ImpurityRatio, DefectiveRatio, periodProduct },
                { 
                    total: lastMetric.total,
                    bad: lastMetric.bad,
                    speed: lastMetric.speed, 
                    ImpurityRatio: lastMetric.ImpurityRatio, 
                    DefectiveRatio: lastMetric.DefectiveRatio, 
                    periodProduct: lastMetric.periodProduct,  
                })
            ) {
                await Sorter.updateOne(
                    {
                        location: locationObj._id,
                        process_id: process_id,
                        ip_address: metric['ip_address'] 
                    }, 
                    { $set: { metrics: [
                        firstMetric,
                        { total, bad, speed, ImpurityRatio, DefectiveRatio, periodProduct, date }
                    ] } }
                );
            }
        }
        await updateDeviceStatus(location, metric['ip_address'], { status: 'Online', device_type: 'sorter-machine' });
    }
    else{
        console.warn('Error: Undefined sorter machine');
    }
}

export const iotConnection = async(location, ip_address, device_type = null) => {
    console.info('iotConnection', ip_address);

    const device = await Location.findOne({ 
        name: location,
        "iotConnected.ip_address": ip_address,
    });

    if(device) {
        await updateDeviceStatus(location, ip_address);
    }
    else {
        let item = {ip_address, status: 'Online'};
        if(device_type) Object.assign(item, { device_type });
        await Location.updateOne(
            { name: location },
            { $push: {iotConnected: item} }
        );
    }

    return await getConnectedDevices(location, 'Online');
}

export const iotDisconnection = async(location, ip_address) => {
    console.info('iotDisconnection', ip_address);
    await updateDeviceStatus(location, ip_address, { status: 'Offline' });
    return await getConnectedDevices(location, 'Online');
}

export const getConnections = async(location, ip_address = null) => {
    if(!ip_address) return await getConnectedDevices(location, 'Online');
    const device = await Location.aggregate([
        {$match: { name : location }},
        {$unwind: '$iotConnected'},
        {$match: { 
            'iotConnected.ip_address': ip_address,
            'iotConnected.status': 'Online',
        }},
    ]);
    return device.length > 0;
}

export const getDevicesList = async(location) => {
    console.info('getDevicesList', location);
    return await getConnectedDevices(location);
}

export const getDeviceType = async(location, ip_address) => {
    let device = await Location.aggregate([
        {$unwind: '$iotConnected'},
        {$match: {
           name : location,
            'iotConnected.ip_address': ip_address
        }},
        {$project: {
            '_id': 0, 
            'device_type': '$iotConnected.device_type',
        }},
    ]);

    if(device.length > 0 && device[0].hasOwnProperty('device_type')) {
        device = device.pop();
        return device.device_type;
    }
    return null;
}

async function getConnectedDevices(location, status = null) {
    let sttms = [
        {$match: { name : location }},
        {$unwind: '$iotConnected'},
    ]

    if(status) sttms.push({$match: { "iotConnected.status": status }});
    sttms.push(
        {$group: {
            _id: {
                _id: "$_id",
                name: "$name",
            },
            iotConnected: { $addToSet: "$iotConnected.ip_address" }
        }},
        {$project: {
            _id: "$_id._id",
            name: "$_id.name",
            iotConnected: 1,
        }}
    );
    
    const device = await Location.aggregate(sttms);
    if(device.length > 0) {
        return device[0];
    }

    return {
        name: location,
        iotConnected: []
    };
}

async function updateDeviceStatus(location, ip_address, data =  { status: 'Online' }) {
    let device = await Location.aggregate([
        {$unwind: '$iotConnected'},
        {$match: {
           name : location,
            'iotConnected.ip_address': ip_address
        }},
        {$project: {
            '_id': 1, 
            '_iotID': '$iotConnected._id'
        }},
    ]);

    if(device.length > 0 && (data.hasOwnProperty('status') || data.hasOwnProperty('device_type'))) {
        let updatedData = {}
        device = device.pop();
        if(data.hasOwnProperty('status')) updatedData[`iotConnected.$.status`] = data['status'];
        if(data.hasOwnProperty('device_type')) updatedData[`iotConnected.$.device_type`] = data['device_type'];
        await Location.updateOne(
            { 
                _id: device._id,
                'iotConnected._id': device._iotID
            }, 
            { $set: updatedData }
        );
    }
}

function isObjectEqual(object1, object2) {
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);
  
    if (keys1.length !== keys2.length) {
      return false;
    }
  
    for (const key of keys1) {
      const val1 = object1[key];
      const val2 = object2[key];
      const areObjects = isObject(val1) && isObject(val2);
      if (
        areObjects && !isObjectEqual(val1, val2) ||
        !areObjects && val1 !== val2
      ) {
        return false;
      }
    }
  
    return true;
  }
  
  function isObject(object) {
    return object != null && typeof object === 'object';
  }