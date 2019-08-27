const sudo = require('sudo');
let ifaces = require('./config.json').iface
const interfaceChecker = require('./iface').iface
const oui = require('oui');
const profiler = require('./db').profiler
const lastPingProfiler = require('./db').lastPingProfiler
const logger = require('./db').logger
const logsTime = require('./config.json').sleepTime * 1000

var lastPing = {}
module.exports.lastPing = lastPing

// Main function
function main() {

    let devicesList = []
    let shortList = []
    // console.log('starting')

    // Find all local network devices.
    find().then(pingResulte => {
        //    console.log(pingResulte.devicesList);
        // Adding the pingResulte.devicesList info to obj
        for (i in pingResulte.devicesList) {

            devicesList.push({ mac: pingResulte.devicesList[i].mac, vendor: pingResulte.devicesList[i].vendor, logs: [{ timestamp: new Date().getTime(), ip: pingResulte.devicesList[i].ip }] })
            shortList.push({ ip: pingResulte.devicesList[i].ip, mac: pingResulte.devicesList[i].mac, vendor: pingResulte.devicesList[i].vendor, lastSeen: pingResulte.timestamp })

        }

        //console.log("Conncted pingResulte.devicesList : " + devicesList.length)
        lastPing = { timestamp: pingResulte.timestamp, devices: shortList }
        //   
        module.exports.lastPing = lastPing
        profiler(shortList)
        lastPingProfiler(lastPing)

        //  console.log("sleep time = " + logsTime / 1000);


        const sleep = () => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    let error = false;
                    if (!error)
                        resolve()
                    else
                        reject()
                }, logsTime)
            })
        }
        status = true
        devicesList = []
        sleep().then(() => {
            //   console.log('running agine ...')
            main()
        }).catch((err) => {

        })

    }).catch((err) => {

        console.log(err)
        interfaceChecker().then((iface) => { if (iface != null) { main() } })

    })



}

function find() {
    return new Promise((resolve, reject) => {



        let net = {}
        let devicesList = []
        let logs = {}


        let promises = []
        ifaces.forEach((id) => {

            promises.push(arp({ arguments: ["-I", `${id}`] }).catch((err) => {
                reject("interface not found")
            }))
        })

        Promise.all(promises)
            .then((arpRes) => {
                // here where arp respone get sorted 
                // because sometimes the user have more than interface
                //have to return logs array 
                // and device list with timestamp
                logs.timestamp = (arpRes[0].timestamp)
                logs.devicesLogs = []
                logs.cache = {}
                for (i in arpRes) {

                    net[ifaces[i]] = arpRes[i].devices
                    logs.cache[ifaces[i]] = arpRes[i].devicesLogs

                }


                for (i in ifaces) {

                    for (x in net[ifaces[i]]) {
                        devicesList.push(net[ifaces[i]][x])

                    }
                    for (b in logs.cache[ifaces[i]]) {
                        logs.devicesLogs.push(logs.cache[ifaces[i]][b])
                    }

                }
                delete logs.cache

                resolve({ timestamp: arpRes[0].timestamp, devicesList: devicesList })

                logger(logs)
            })



    })

}





function arp(options) {

    return new Promise((resolve, reject) => {
        let logs = []
        let arpRes = {}
        const IP_INDEX = 0;
        const MAC_ADDRESS_INDEX = 1;

        //   console.log('Start scanning network');

        let commandArguments = ['-l', '-q'];
        if (options && options.arguments) {
            commandArguments = commandArguments.concat(options.arguments)
        }

        const arpCommand = sudo(['arp-scan'].concat(commandArguments));

        let bufferStream = '';
        let errorStream = '';


        arpCommand.stdout.on('data', data => {
            bufferStream += data;

        });

        arpCommand.stderr.on('data', error => {
            errorStream += error;
            reject('interface not found')
        });


        arpCommand.on('close', code => {
            //    console.log('Scan finished');

            if (code !== 0) {
                console.log('Error: ' + code + ' : ' + errorStream);
                return;
            }

            const rows = bufferStream.split('\n');
            const devices = [];

            for (let i = 2; i < rows.length - 4; i++) {
                const cells = rows[i].split('\t').filter(String);
                const device = {};

                if (cells[IP_INDEX]) {
                    device.ip = cells[IP_INDEX];
                }

                if (cells[MAC_ADDRESS_INDEX]) {
                    device.mac = cells[MAC_ADDRESS_INDEX];
                    device.vendor = ((oui(device.mac)).split('\n')[0])
                }
                logs.push({ ip: device.ip, mac: device.mac })
                devices.push(device);
            }
            arpRes.timestamp = new Date().getTime()
            arpRes.devicesLogs = logs
            arpRes.devices = devices
            // console.log(arpRes);
            resolve(arpRes)

        });

    })
}


module.exports.main = main;