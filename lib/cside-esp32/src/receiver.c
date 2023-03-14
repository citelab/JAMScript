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
    //uint8_t raw_buffer[256];
    uint16_t buffer_length;

    tboard_t* tboard = get_device_cnode()->tboard;


    int status;
    while(1)
    {           
        printf("Waiting for message...\n");
        status = netconn_recv(ctx->conn, &buffer);
        if(status == ERR_OK)
        {
            do
            {            
                printf("Received: Buffer of length %d\n", buffer->p->len);

                //dump_bufer_hex(buffer->p->payload, buffer->p->len);

                command_t* cmd = command_from_data(NULL, buffer->p->payload, buffer->p->len);

                process_message(tboard, cmd);
                
                command_free(cmd);
        
            } while (netbuf_next(buffer) > 0);

            netbuf_delete(buffer);
        }
        else
        {
            printf("Somethign happened here!!!\n\n\n\n");
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

    assert(netconn_bind(ctx->conn, NULL, 16501)==ERR_OK);

    //netconn_join_leave_group();

    // Start receiving/processing thread
    xTaskCreatePinnedToCore(receiver_thread, 
                            "Netconn Thread", 
                            STACK_SIZE*4, 
                            ctx, 
                            2,
                            NULL, 
                            0);
}
