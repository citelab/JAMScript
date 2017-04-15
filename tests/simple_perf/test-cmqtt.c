
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <MQTTClient.h>

#include <sys/time.h>


#define ADDRESS     "tcp://localhost:1883"
#define CLIENTID    "ExampleClientSub"
#define TOPIC       "/testtopic"
#define PAYLOAD     "Hello World!"
#define QOS         1
#define TIMEOUT     10000L

volatile MQTTClient_deliveryToken deliveredtoken;

//MQTTClient mqtt_open(char *mhost);
void mqtt_publish(MQTTClient mcl, char *topic, char *msg);

long long start, end;


long long activity_getseconds()
{
    struct timeval tp;

    if (gettimeofday(&tp, NULL) < 0)
    {
        printf("ERROR!! Getting system time..");
        return 0;
    }

    return tp.tv_sec * 1000000LL + tp.tv_usec;
}


int msgarrvd(void *ctx, char *topicname, int topiclen, MQTTClient_message *msg)
{
    end = activity_getseconds();    
    printf("Message arrived .. start: %lld, end: %lld, diff: %lld \n", start, end, (end - start));
    exit(0);
    return 0;
}

void delivered(void *ctx, MQTTClient_deliveryToken dt)
{
    printf("Message with token value %d delivery confirmed\n", dt);
    deliveredtoken = dt;
}

void connlost(void *context, char *cause)
{
    printf("\nConnection lost\n");
    printf("     cause: %s\n", cause);
}

int main()
{
    char server[256];
    int ch;

    // sprintf(server, "tcp://localhost:1883");
    // MQTTClient cl = mqtt_open(server);
    // MQTTClient_subscribe(cl, "/testtopic", 1);
    // MQTTClient_setCallbacks(cl, NULL, NULL, arrived, NULL);


    MQTTClient client;
    MQTTClient_connectOptions conn_opts = MQTTClient_connectOptions_initializer;
    int rc;

    MQTTClient_create(&client, ADDRESS, CLIENTID,
        MQTTCLIENT_PERSISTENCE_NONE, NULL);
    conn_opts.keepAliveInterval = 20;
    conn_opts.cleansession = 1;
    MQTTClient_setCallbacks(client, NULL, connlost, msgarrvd, delivered);
    if ((rc = MQTTClient_connect(client, &conn_opts)) != MQTTCLIENT_SUCCESS)
    {
        printf("Failed to connect, return code %d\n", rc);
        exit(-1);
    }
    printf("Subscribing to topic %s\nfor client %s using QoS%d\n\n"
           "Press Q<Enter> to quit\n\n", TOPIC, CLIENTID, QOS);
    MQTTClient_subscribe(client, TOPIC, QOS);


    start = activity_getseconds();

    mqtt_publish(client, "/testtopic", "hello");

    do 
    {
        ch = getchar();

    } while(ch!='Q' && ch != 'q');

    return 0;
}
