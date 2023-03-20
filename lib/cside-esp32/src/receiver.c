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
#include <esp_timer.h>
#include <util.h>

#include <lwip/stats.h>

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
    int64_t start_time, proc_start_time;
    int64_t cummulative_processing = 0;
    start_time = esp_timer_get_time();
    int count = 0;
    int count_limit = 10000;
    
    while(1)
    {
        status = netconn_recv(ctx->conn, &buffer);
        if(status == ERR_OK)
        {
            if(count == count_limit)
            {
                printf("Processing %d messages took %lld time spent processing was: %lld\n", count_limit, esp_timer_get_time() - start_time, cummulative_processing);
                cummulative_processing = 0;
                count = 0;
                start_time = esp_timer_get_time();

                stats_display();
            }

            proc_start_time = esp_timer_get_time();
            do
            {       
                count++;     
                //printf("Received: Buffer of length %d\n", buffer->p->len);

                //dump_bufer_hex(buffer->p->payload, buffer->p->len);

                //command_t* cmd = command_from_data(NULL, buffer->p->payload, buffer->p->len);

                //process_message(tboard, cmd);
                
                //command_free(cmd);

            } while (netbuf_next(buffer) > 0);

            netbuf_delete(buffer);

            cummulative_processing += esp_timer_get_time() - proc_start_time;
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
