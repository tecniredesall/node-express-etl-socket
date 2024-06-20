export function parseDeviceMessage(message) {
    try {
        return JSON.parse(message);
    } catch (e) {
        return message;
    }
}

export function parseScaleMessage(message, ip_address) {
    let weight = 0;
    message = message.toString();
    var matches = message.match(/(\d+(\.\d+)?)/);
    if (matches) {
        weight = matches[0];
        let units = null;
        if(message.match(/(kg|kgs|kilo|kilos)/)) units = 'kg';
        if(message.match(/(lb|lbs|libra|libras)/)) units = 'lb';
        const metric = {
            weight,
            units,
            date: new Date(),
            ip_address
        };

        return metric;
    }
    return null;
}

export function parseSorterMessage(message, ip_address) {
    if(message.code == 600) {
        const { total, bad, speed, ImpurityRatio, DefectiveRatio, periodProduct } = message;
        const metric = {
            total,
            bad,
            speed,
            ImpurityRatio,
            DefectiveRatio,
            periodProduct,
            date: new Date(),
            ip_address,
        };
        return metric;
    }
    
    return null;
}

