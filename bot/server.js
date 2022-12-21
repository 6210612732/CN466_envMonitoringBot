'use strict';

const express = require('express');
const mqtt = require('mqtt');
require('dotenv').config();
const { MongoClient } = require("mongodb");
const line = require('@line/bot-sdk');
const ngrok = require('ngrok');



// Constants
const PORT = 8080;
const HOST = '0.0.0.0';
const line_cfg = {
    channelAccessToken: process.env.LINE_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CH_SECRET
};

// App
var data_idx = 0;
var pressure_value =0;
var temp_value = 0;
var humid_value = 0;
const app = express();

app.use('/',express.static('liff'));

app.get('/api/sensor',async(req, res) => {
    const ans = {idx:data_idx , pressure:pressure_value, temp:temp_value , humid:humid_value}
    res.send(JSON.stringify(ans))
})

//MQTT
const mqttclient  = mqtt.connect("mqtt://broker.hivemq.com"); ////// mqtt broker
mqttclient.on('connect', function () {
    mqttclient.subscribe('cn466_g01/sensors/device1', function (err) {
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
    console.log("here---->",msg)
    try_insert(msg).catch(console.dir);
    data_idx = data_idx + 1;
    pressure_value = msg.pressure;
    temp_value = msg.temperature;
    humid_value = msg.humidity;
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

async function try_insert(msg) {
    try {
        await mongodbclient.connect();
        const database = mongodbclient.db('envmonitoring');
        const sensor = database.collection('sensor');
        const doc = {   
                        timestamp: new Date(),
                        temperature : msg.temperature,
                        pressure : msg.pressure,
                        humidity : msg.humidity
                    }
        console.log(doc);
        const result = await sensor.insertOne(doc);
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

async function get_data() {
    
    try {
        await mongodbclient.connect();
        const database = mongodbclient.db('envmonitoring');
        const sensor = database.collection('sensor')
        var data = await sensor.find().sort({'_id':-1}).limit(1).toArray()

    } finally {
        await mongodbclient.close()
    }  
    return data
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

async function handleEvent(event) {
    if (event.type !== 'message' || event.message.type !== 'text') {
      // ignore non-text-message event
      return Promise.resolve(null);
    }
    
    // create a echoing text message
    const echo = { type: 'text', text: event.message.text };
    
    if (event.message.text == "status") {
        
        const data = await get_data()
            
        console.log(`output = ${(JSON.stringify(data))}`)
            
        var temp = parseFloat(data[0].temperature).toFixed(2)
        var humidity = parseFloat(data[0].humidity).toFixed(2)
        var pressure = parseFloat(data[0].pressure).toFixed(2)

        echo.text =  
`Temperature : ${temp} 
Pressure : ${pressure} 
Humidity : ${humidity}`;
           
        return lineClient.replyMessage(event.replyToken, echo);
    }else{
        return lineClient.replyMessage(event.replyToken, echo);
    }
              
}


app.listen(PORT, () => {
    console.log("It seems that BASE_URL is not set. Connecting to ngrok...")
    ngrok.connect({addr:PORT, authtoken:process.env.NGROK_AUTH_TOKEN}).then(url => {
    console.log('listening on ' + url + '/callback');
    lineClient.setWebhookEndpointUrl(url + '/callback');
    }).catch(console.error);
});

