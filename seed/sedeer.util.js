import Location from '../server/models/location.model';
import Scale from '../server/models/scale.model';
export default async () =>  {
    let item = { name: 'Capucas', port: 9898 };
    const locationObj = new Location(item);
    await locationObj.save();

    const isDev =  ['dev', 'development', 'stage', 'staging', 'qa', 'test'].includes(process.env.NODE_ENV);
    if(isDev) {
        await new Scale({ 
            location: locationObj._id,
            ip_address: '192.168.1.100',
            metrics: [
                {
                    weight: "1000",
                    units: "kg",
                    date: new Date(),
                },{
                    weight: "10001",
                    units: "kg",
                    date: new Date(),
                },
            ]
        }).save();
        await new Scale({ 
            location: locationObj._id,
            ip_address: '192.168.1.101',
            metrics: [
                {
                    weight: "1002",
                    units: "lb",
                    date: new Date(),
                },
            ]
        }).save();
    }

    //if(isDev) await new Location({ name: 'Capucas 2', port: 9899 }).save();
    process.exit(1);
};