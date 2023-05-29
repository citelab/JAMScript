#include "multicast.h"

#include <esp_wifi.h>
#include <lwip/err.h>
#include <lwip/sys.h>

#include <stdlib.h>
#include <esp_timer.h>
#include <constants.h>
#include <udp.h>

uint32_t factor_two_round_up(uint32_t num)
{
    return num + (num%2);
}

jam_error_t multicast_init(multicast_t* multicast, ipv4_address_t destination, port_t retport, port_t outgoing, uint32_t buffer_size)
{
    int status = JAM_OK;

    *multicast = (multicast_t) {0};
    multicast->packet_buffer_size = factor_two_round_up(buffer_size);
    ERR_PROP(udp_packet_init_headers(&multicast->packet_template, destination, retport, outgoing));

    return status;
}

multicast_t* multicast_create(ipv4_address_t destination, port_t retport, port_t outgoing, uint32_t buffer_size)
{
    uint32_t multicast_size = sizeof(multicast_t) + factor_two_round_up(buffer_size);
    multicast_t* multicast = (multicast_t*) aligned_alloc(4, multicast_size); 
    
    printf("Creating multicast for %d : %d \n", (int)retport, (int)outgoing);
    if(multicast_init(multicast, destination, retport, outgoing, buffer_size)!=JAM_OK)
    {
        printf("Wasnt able to create multicast dispatcher for ports %d : %d \n", (int)retport, (int)outgoing);
        free(multicast);
        return NULL;
    }

    return multicast;
}

void multicast_make_threadsafe(multicast_t* multicast)
{
    multicast->buffer_access = xSemaphoreCreateMutex();
    multicast->thread_safe = true;
}

// returns udp data buffer
uint8_t* _multicast_get_internal_buffer(multicast_t* multicast)
{
    return ((uint8_t*)multicast) + sizeof(multicast_t);
}

jam_error_t multicast_copy_send(multicast_t* multicast, void* buf, uint32_t buf_size)
{
    assert(buf_size <= multicast->packet_buffer_size);

    if(multicast->thread_safe)
        assert(xSemaphoreTake(multicast->buffer_access, 200) == pdTRUE);

    //dump_bufer_hex(buf, buf_size);

    memcpy(_multicast_get_internal_buffer(multicast), buf, buf_size);

    multicast_send(multicast, buf_size);

    if(multicast->thread_safe)
        xSemaphoreGive(multicast->buffer_access);


    return JAM_OK;
}

// The destination needs to register into an IGMP group, responses will be unicast.
jam_error_t multicast_send(multicast_t* multicast, uint32_t buf_size)
{
    multicast->occupied_packet_buffer_size = buf_size;
    
    udp_packet_package(&multicast->packet_template, buf_size);

    int status;
    do
    {
        status = esp_wifi_80211_tx(WIFI_IF_STA, &multicast->packet_template, udp_packet_size(buf_size), 1);
        if(status == ESP_ERR_NO_MEM)
        {
            // NOTE: could come up with a better approach for handling wifi-driver running out of memory..
            vTaskDelay(5);
        }
    } while (status == ESP_ERR_NO_MEM);
    
    return JAM_OK;
}

void* multicast_get_packet_buffer(multicast_t* multicast, uint32_t* buffer_size)
{   
    if(buffer_size!=NULL)
        *buffer_size = multicast->packet_buffer_size;
    return _multicast_get_internal_buffer(multicast);
}