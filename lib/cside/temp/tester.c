#include "mqtt-adapter.h"
#include <unistd.h>
#include <stdio.h>
#include "command.h"

/* 
 * Test-0: Basic test with device level only
 * Send messsages and receive messages to the controller
 */

#ifdef TESTMAIN
int main() 
{
    command_t *cmd;
    // init the library
    mqtt_lib_init();
    // create the adapter
    struct mqtt_adapter_t *ma = create_mqtt_adapter("device-controller");
    // hookup the callbacks
    mqtt_set_all_cbacks(ma, mqtt_connect_callback, 
            mqtt_message_callback, mqtt_subscribe_callback, 
            mqtt_publish_callback, mqtt_log_callback);
    // post the subscriptions 
    mqtt_post_subscription(ma, "/server");
    mqtt_post_subscription(ma, "/info");    

    // connect the adapter
    struct broker_info_t b = {.host = "localhost", .port = 1883, .keep_alive = 60};
    connect_mqtt_adapter(ma, &b);

    int j = 10000000;
    while(j-- > 0) {
        // publish on the adapter
	cmd = command_new("REGISTER", "DEVICE", "-", j, "-", "-", "device_id", "");
        printf("J = %d\n,", j);
        /*
        cbor_item_t *cstr = cbor_build_string("hello, message from C");
        unsigned char buf[64];
        int buflen = cbor_serialize(cstr, buf, 64);
        printf("Buffer has %d bytes \n", buflen);
        */
        mqtt_publish(ma, "/info", cmd->buffer, cmd->length, cmd, 0);
	//	command_free(cmd);
	//        sleep(1);
    }

    destroy_mqtt_adapter(ma);
}
#endif
