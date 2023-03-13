#include "receiver.h"
#include <lwip/api.h>
#include <lwip/netbuf.h>
#include <lwip/err.h>
#include <stdint.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include "cnode.h"
#include "constants.h"
#include <processor.h>
#include <command.h>
#include <util.h>

void receiver_thread(void* raw_ctx)
{
    receiver_context_t* ctx = (receiver_context_t*) raw_ctx;

    printf("Starting Receiver/Processor Thread...\n");


    //TODO: change this.
    while(!get_device_cnode_initialized())
    {
        vTaskDelay(200);
    }

    printf("Starting Receiver/Processor Loop...\n");


    struct netbuf* buffer;
    uint8_t raw_buffer[256];
    uint16_t buffer_length;

    tboard_t* tboard = get_device_cnode()->tboard;

    int status;
    while(1)
    {
        status = netconn_recv(ctx->conn, &buffer);
        if(status == ERR_OK)
        {
            buffer_length = netbuf_len(buffer);
            
            netbuf_copy(buffer, raw_buffer, 256);
    
            printf("Received: Buffer of length %d\n", buffer_length);

            // This is just a test
            if(buffer_length > 50)
            {

                dump_bufer_hex(raw_buffer, buffer_length);

                command_t* cmd = command_from_data(NULL, raw_buffer, buffer_length);
                process_message(tboard, cmd);
                command_free(cmd);
            }

            netbuf_free(buffer);
        }
    }
}

void _join_group()
{

}

void receiver_init()
{
    receiver_context_t* ctx = calloc(1, sizeof(receiver_context_t));


    // Configure UDP listiner
    ctx->conn = netconn_new(NETCONN_UDP);
    assert(ctx->conn != NULL);

    assert(netconn_bind(ctx->conn, NULL, Multicast_RECVPORT)==ERR_OK);

    //netconn_join_leave_group();

    // Start receiving/processing thread
    xTaskCreatePinnedToCore(receiver_thread, 
                            "Netconn Thread", 
                            STACK_SIZE, 
                            ctx, 
                            2,
                            NULL, 
                            0);
}
