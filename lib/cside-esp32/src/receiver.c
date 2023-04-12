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

static command_t _proc_command;

void espcount();
void receiver_thread(void* raw_ctx)
{
    receiver_context_t* ctx = (receiver_context_t*) raw_ctx;

    printf("Starting Receiver/Processor Thread...\n");


    //TODO: change this.
    while(!get_device_cnode_initialized())
    {
        vTaskDelay(200);
    }

    processor_init();

    printf("Starting Receiver/Processor Loop...\n");


    struct netbuf* buffer;
    //uint8_t raw_buffer[256];
    uint16_t buffer_length;

    tboard_t* tboard = get_device_cnode()->tboard;


    int status;
    int64_t start_time, proc_start_time, command_start_time, netconn_recv_start;
    int64_t cummulative_processing = 0, cummulative_recv = 0, command_processing = 0;
    start_time = esp_timer_get_time();
    int count = 0;
    int count_limit = 10000;
    
    while(1)
    {
        netconn_recv_start = esp_timer_get_time();

        status = netconn_recv(ctx->conn, &buffer);

        cummulative_recv += esp_timer_get_time() - netconn_recv_start;

        if(status == ERR_OK)
        {
            if(count == count_limit)
            {
                printf("Processing %d messages:\n-- ovrl time: %lld\n-- proc time: %lld\n-- recv time: %lld\n-- comd timel: %lld\n", 
                    count_limit, 
                    esp_timer_get_time() - start_time, 
                    cummulative_processing,
                    cummulative_recv,
                    command_processing);
                cummulative_processing = 0;
                cummulative_recv = 0;
                count = 0;
                start_time = esp_timer_get_time();
                //stats_display();
            }

            proc_start_time = esp_timer_get_time();

            //espcount();
            do
            {       
                count++;     
                command_start_time = esp_timer_get_time();


                memcpy(_proc_command.buffer, buffer->p->payload, buffer->p->len);
                command_from_data_inplace(&_proc_command, NULL, buffer->p->len);

                command_processing += esp_timer_get_time() - command_start_time;


                process_message(tboard, &_proc_command);
                
                command_args_free(_proc_command.args);

            } while (netbuf_next(buffer) > 0);

            netbuf_delete(buffer);

            taskYIELD();

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
