'use strict';

const express = require('express');
const mqtt = require('mqtt');
require('dotenv').config();
const { MongoClient } = require("mongodb");
const line = require('@line/bot-sdk');



// Constants
const PORT = 8080;
const HOST = '0.0.0.0';
const line_cfg = {
    channelAccessToken: process.env.LINE_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CH_SECRET
};

// App
var data_idx = 0;
var temp_value = 0;
var humid_value = 0;
const app = express();

app.use('/',express.static('liff'));

app.get('/api/sensor',async(req, res) => {
    const ans = {idx:data_idx , pressure:pressure_value, temp:temp_value , humid:humid_value}
    res.send(JSON.stringify(ans))
})


var client = mqtt.connect(options);
//MQTT
var options = {
    host: 'efcc767b01804c3f8bec205ff536fea2.s2.eu.hivemq.cloud',
    port: 8883,
    protocol: 'mqtts',
    username: 'krusty',
    password: 'A123456b'
}
const mqttclient  = mqtt.connect(options); ////// mqtt broker
mqttclient.on('connect', function () {
    mqttclient.subscribe('envmonitoring/sensor', function (err) {
        if (!err) {
            const obj = {status:'ok'};
            mqttclient.publish('envmonitoring/status', JSON.stringify(obj))
        }
    })
})
mqttclient.on('message', function (topic, message) {
    // message is Buffer
    console.log(message.toString());
    const msg = JSON.parse(message.toString());
    try_insert(msg.temp).catch(console.dir);
    data_idx = data_idx + 1;
    pressure_value = msg.pressure;
    temp_value = msg.temp;
    humid_value = msg.humid;
    lineClient.pushMessage(process.env.USER_ID,{type:'text',text:msg.temp.toString()})
})


//database
const mongodbclient = new MongoClient(process.env.MONGODB_URI);
async function try_connect() {
    try {
        await mongodbclient.connect();
        const database = mongodbclient.db('envmonitoring');
        try{
            await database.createCollection("sensor")    
            console.log("Collection created!");  
            
        } catch (err) {
            console.log("Collection existed")
        }
    }
    finally{
        mongodbclient.close();
    }
}

try_connect().catch(console.dir);

async function try_X(value) {
    try {
        await mongodbclient.connect();
        const database = mongodbclient.db('envmonitoring');
        const sensor = database.collection('sensor');
        //do x
    }
    finally{
        await mongodbclient.close();
    }
}

async function try_insert(value) {
    try {
        await mongodbclient.connect();
        const database = mongodbclient.db('envmonitoring');
        const sensor = database.collection('sensor');
        const doc = {   
                        timestamp: new Date(),
                        value : value
                    }
        console.log(doc);
        const result = await sensor.insertOne(doc);
        console.log(result);
    }
    finally{
        await mongodbclient.close();
    }
}

async function try_query(value) {

    var results = []

    try {

        await mongodbclient.connect();
        const database = mongodbclient.db('envmonitoring');
        const sensor = database.collection('sensor')
        const cond = {value: value}
        results = await sensor.find(cond).toArray()    

    } finally {
        await mongodbclient.close()
    }

    //console.log(results)  
    return results

}

//line
const lineClient = new line.Client(line_cfg);
app.post('/callback', line.middleware(line_cfg), (req, res) => {
    Promise
      .all(req.body.events.map(handleEvent))
      .then((result) => res.json(result))
      .catch((err) => {
        console.error(err);
        res.status(500).end();
      });
});

function handleEvent(event) {
    if (event.type !== 'message' || event.message.type !== 'text') {
      // ignore non-text-message event
      return Promise.resolve(null);
    }
  
    // create a echoing text message
    const echo = { type: 'text', text: event.message.text };
  
    // use reply API
    return lineClient.replyMessage(event.replyToken, echo);
}

app.listen(PORT, () => {

});

