#include <Arduino.h>
//Hardware
#include <Wire.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_HTS221.h>
//WiFi
#include <WiFi.h>
#include <WiFiManager.h>
//MQTT
#include <PubSubClient.h>
#include <WiFiClient.h>

Adafruit_BMP280 bmp;
Adafruit_HTS221 hts;

void setupHardware() {
  Wire.begin(41, 40, 100000);
  if(bmp.begin(0x76)) {
    //prepare BMP280 sensor
    Serial.println("BMP280 sensor ready.");
  }
  if(hts.begin_I2C()) {
    //prepare HTS221 sensor
    Serial.println("HTS221 sensor ready.");
  }
  pinMode(2, OUTPUT);
  digitalWrite(2, HIGH);
}

/*For WiFi*/
WiFiManager wm;

static void setupWifi() {
  // set wifimanager
  WiFi.mode(WIFI_AP);  
  //wm.resetSettings();

  wm.autoConnect("wm_test","12345678");
  Serial.print(WiFi.RSSI());
}


/*MQTT*/

static WiFiClient wfClient;
static PubSubClient client(wfClient);
const char * broker = "broker.mqttdashboard.com";

static void setupMQTT() {
  Serial.println(" + MQTT Connecting.");

  client.setServer(broker, 1883);

  while (client.connected() != MQTT_CONNECTED) 
  {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println(" + Complete.");
}

void mqttReconnect() {
  while(!client.connected()) {
    Serial.println("Attempting MQTT connection...");

    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);

    if(client.connect(clientId.c_str())) {
      Serial.println("connected");
      client.publish("panIot/MQTTStatus", "MQTT Connected");
    } else {
      Serial.println("failed, rc=");
      Serial.println(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}


void setup() {
  // put your setup code here, to run once:
  Serial.begin(115200);
  setupHardware();
  setupWifi();
  setupMQTT();
  Serial.println("Begin!!!");
}

void loop() {
  // put your main code here, to run repeatedly:
  mqttReconnect();
  char json_body[200];
  const char json_tmpl[] = "{\"pressure\": %.2f," 
                          "\"temperature\": %.2f," 
                          "\"humidity\": %.2f}";
  sensors_event_t temp, humid;
  sensors_event_t a, g;


  float p = bmp.readPressure();
  hts.getEvent(&humid, &temp);
  float t = temp.temperature;
  float h = humid.relative_humidity;

  sprintf(json_body, json_tmpl, p, t, h);
  Serial.println(json_body);
  client.publish("cn466_g01/sensors/device1", json_body);
  
  
  
  delay(1000); // Delay a second between loops.

}
