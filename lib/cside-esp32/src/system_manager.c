#include "system_manager.h"
#include <stdint.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <esp_event.h>
#include <esp_netif_sntp.h>
#include <esp_sntp.h>
#include <esp_event.h>
#include <lwip/ip_addr.h>
#include <esp_wifi.h>
#include <nvs_flash.h>
#include <udp.h>
#include <receiver.h>
#include <constants.h>
#include <stdlib.h>

#define MAX_RECONNECTION_ATTEMPTS 8


//#define SHOULD_SKIP_WIFI_INIT

system_manager_t _global_system_manager;
static TaskHandle_t _init_task;
static bool _system_initialized = false;
static void _system_manager_event_handler(void* arg, esp_event_base_t event_base,
                                          int32_t event_id, void* event_data);

static void _system_manager_event_handler(void* arg, esp_event_base_t event_base,
                                          int32_t event_id, void* event_data);

system_manager_t* system_manager()
{
    return &_global_system_manager;
}


system_manager_t* system_manager_init()
{
    assert(!_system_initialized && "System Manager was initialized a second time!");

    system_manager_t* system_manager = &_global_system_manager;
    memset(system_manager, 0, sizeof(system_manager_t));

    system_manager->_connection_attempts = 0;
    system_manager->wifi_connection = false;

    _init_task = xTaskGetCurrentTaskHandle();

    _system_manager_board_init(system_manager);

#ifndef SHOULD_SKIP_WIFI_INIT
    // Currently skipping ntp because the controller is currently not connected to the internet  
    // _system_manager_rtc_sync_ntp(system_manager);
#endif

    udp_init_stack();

    _system_initialized = true;

    return system_manager;
}

void _system_manager_board_init(system_manager_t* system_manager)
{
    ESP_ERROR_CHECK(nvs_flash_init());

#ifndef SHOULD_SKIP_WIFI_INIT
    _system_manager_net_init(system_manager);
#endif  
}

// Initialise wifi and netif to act as a station
void _system_manager_net_init(system_manager_t* system_manager)
{
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    esp_netif_create_default_wifi_sta();

    wifi_init_config_t wifi_init_config = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&wifi_init_config));

    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                        ESP_EVENT_ANY_ID,
                                                        &_system_manager_event_handler,
                                                        system_manager,
                                                        &system_manager->wifi_any_event_handle));

    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT,
                                                        IP_EVENT_STA_GOT_IP,
                                                        &_system_manager_event_handler,
                                                        system_manager,
                                                        &system_manager->got_ip_event_handle));    
    wifi_config_t wifi_config = {
	.sta = {
	    .ssid = PRECONFIG_WIFI_SSID,
	    .threshold.authmode = WIFI_AUTH_OPEN
	}
    };

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));

    esp_wifi_config_80211_tx_rate(WIFI_IF_STA, WIFI_PHY_RATE_54M);
    //esp_wifi_config_80211_tx_rate(WIFI_IF_STA, WIFI_PHY_RATE_MAX);

    ESP_ERROR_CHECK(esp_wifi_start());

    esp_wifi_set_ps(WIFI_PS_NONE);

    // Wait for wifi connection before continuing init.
    xTaskNotifyWait(0, WIFI_CONNECTION_NOTIFICATION, NULL, portMAX_DELAY);
}

void _system_manager_rtc_sync_ntp(system_manager_t* system_manager)
{
    printf("Initializing and starting SNTP\n");

    // This is rtc sync code from esp32 examples
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG(SNTP_SERVER);

    esp_netif_sntp_init(&config);

    int retry = 0;
    const int retry_count = 15;

    while (esp_netif_sntp_sync_wait(2000 / portTICK_PERIOD_MS) == ESP_ERR_TIMEOUT && ++retry < retry_count) 
    {
        printf("Waiting for system time to be set... (%d/%d)\n", retry, retry_count);
    }

    assert(retry != retry_count && "Failed to connect to sntp");

    // Setup timezone
    setenv("TZ", TIMEZONE, 1);
    tzset();

    // Get current time
    time_t now = 0;
    struct tm timeinfo = { 0 };

    time(&now);
    localtime_r(&now, &timeinfo);
    printf("Current Time %s", asctime(&timeinfo));
}

static void _system_manager_event_handler(void* arg, esp_event_base_t event_base,
                                          int32_t event_id, void* event_data)
{
    system_manager_t* system_manager = (system_manager_t*) arg;

    if(event_base == WIFI_EVENT)
    {
        switch(event_id)
        {
            case WIFI_EVENT_STA_START:
                esp_wifi_connect();
                break;
            case WIFI_EVENT_STA_DISCONNECTED:
                system_manager->wifi_connection = false;
                if(system_manager->_connection_attempts < MAX_RECONNECTION_ATTEMPTS)
                {
                    esp_wifi_connect();
                    system_manager->_connection_attempts++;
                    system_manager->wifi_connection = false;
                    printf("Attempting to reconnect to network...\n");
                }
                else
                {
                    assert(0 && "Failed to connect to local network... unrecoverable state.");
                }
                break;
            default: return;
        }
    }
    else if(event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP)
    {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        system_manager->ip_info = event->ip_info;

        printf("Succesfully connected to Network, IP: " IPSTR "\n", IP2STR(&system_manager->ip_info.ip));

        system_manager->_connection_attempts = 0;
        system_manager->wifi_connection = true;
        
        // If still in initialization stage, wake main init thread
        if(!_system_initialized)
            {
            xTaskNotify(_init_task,
                        WIFI_CONNECTION_NOTIFICATION,
                        eSetBits);
        }
    }
}
