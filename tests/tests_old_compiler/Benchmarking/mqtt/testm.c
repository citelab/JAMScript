#include "mqtt-adapter.h"
#include "command.h"
#include "constants.h"
#include "cnode.h"

void send_ack_msg2(struct mqtt_adapter *ma, char *node_id, uint64_t task_id, int timeout)
{
    //    server_t *s = (server_t *)serv;
    //    cnode_t *c = s->cnode;
    
    command_t *cmd = command_new(CmdNames_PING, 0, "", task_id, "c->core->device_id", node_id, "i", timeout);
    mqtt_publish(ma, "/xxx/announce/down", cmd->buffer, cmd->length, cmd, 0);
}

void send_request(struct mqtt_adapter *ma, char *node_id)
{
    static uint64_t task_id = 100;
    static int arg = 100;
    
    command_t *cmd = command_new(CmdNames_REXEC, 0, "testfunc", task_id, "node_id_string", "old_node_id_string", "i", arg);
    mqtt_publish(ma, "/xxx/requests/down/c", cmd->buffer, cmd->length, cmd, 0);
    task_id++;
    arg++;
    printf("Arg = %d\n", arg);
}


int main()
{
    server_t *serv = (server_t *)calloc(1, sizeof(server_t));
    struct mqtt_adapter *ma = create_mqtt_adapter(0, serv);
    broker_info_t b = {.keep_alive = 60};
    strcpy(b.host, "127.0.0.1");
    b.port = 1883;
    connect_mqtt_adapter(ma, &b);
    for (int i = 0; i < 1000000; i++)
	    //send_request(ma, "dfsdfdfsdfsdf");
        send_ack_msg2(ma, "dffasdfdfdsf", 1212121212, 100);

}
