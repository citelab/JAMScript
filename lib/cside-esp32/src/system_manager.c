#include "system_manager.h"
#include <esp_netif_sntp.h>
#include <esp_sntp.h>
#include <esp_event.h>
#include <lwip/ip_addr.h>
#include <esp_wifi.h>

#include <stdlib.h>

#define MAX_RECONNECTION_ATTEMPTS 8
#define PRECONFIG_WIFI_SSID "TODO: fill this in"
#define PRECONFIG_WIFI_PASS "TODO: fill this in"


system_manager_t _global_system_manager;

static void _system_manager_event_handler(void* arg, esp_event_base_t event_base,
                                          int32_t event_id, void* event_data);

system_manager_t* system_manager_init()
{
    system_manager_t* system_manager = &_global_system_manager;
    memset(system_manager, 0, sizeof(system_manager_t));

    _system_manager_board_init(system_manager);
    _system_manager_rtc_sync_ntp(system_manager);

    system_manager->initialized = true;
    system_manager->_connection_attempts = 0;
    system_manager->wifi_connection = false;
    return system_manager;
}

void _system_manager_board_init(system_manager_t* system_manager)
{
    ESP_ERROR_CHECK(nvs_flash_init());

    _system_manager_net_init(system_manager);
    //TODO: might have to initialize in station mode

}

// Initialise wifi and netif to act as a station
void _system_manager_net_init(system_manager_t* system_manager)
{
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    // Netif wifi Init -- TODO: Understand exactly what this step does
    esp_netif_create_default_wifi_sta();

    // TODO: what exactly does this do compared to the above line.
    wifi_init_config_t wifi_config = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&wifi_config));


    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                        ESP_EVENT_ANY_ID,
                                                        &_system_manager_event_handler,
                                                        system_manager,
                                                        &system_manager->wifi_any_event_handle));

    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT,
                                                        IP_EVENT_STA_GOT_IP,
                                                        &event_handler,
                                                        system_manager,
                                                        &system_manager->got_ip_event_handle));
    
    // This is a temporary wifi_config
    wifi_config_t wifi_config = {
        .sta = {
            .ssid       = PRECONFIG_WIFI_SSID,
            .password   = PRECONFIG_WIFI_PASS,
            .threshold.authmode = ESP_WIFI_SCAN_AUTH_MODE_THRESHOLD,
            .sae_pwe_h2e        = WPA3_SAE_PWE_BOTH,
        },
    };

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    // TODO: should maybe wait for wifi connection to happen.
}

void _system_manager_rtc_sync_ntp(system_manager_t* system_manager)
{
    ESP_LOGI(TAG, "Initializing and starting SNTP");

    // This is rtc sync code from esp32 examples
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG(CONFIG_SNTP_TIME_SERVER);

    config.sync_cb = time_sync_notification_cb;
    esp_netif_sntp_init(&config);

    time_t now = 0;
    struct tm timeinfo = { 0 };
    int retry = 0;
    const int retry_count = 15;

    while (esp_netif_sntp_sync_wait(2000 / portTICK_PERIOD_MS) == ESP_ERR_TIMEOUT && ++retry < retry_count) 
    {
        ESP_LOGI(TAG, "Waiting for system time to be set... (%d/%d)", retry, retry_count);
    }

    assert(retry != retry_count && "Failed to connect to sntp");

    time(&now);
    localtime_r(&now, &timeinfo);

    esp_netif_sntp_deinit();
}

// TODO: think about how useful event group bits are...

static void _system_manager_event_handler(void* arg, esp_event_base_t event_base,
                                          int32_t event_id, void* event_data)
{
    system_manager_t* system_manager = (system_manager_t*) arg;
    assert(system_manager->initialized);

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
                    printf("Attempting to reconnect to network...\n");
                    //TODO: consider setting a wifi fail flag
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

        printf("Succesfully connected to Network, IP: " IPSTR, IP2STR(&system_manager->ip_info.ip));
        
        system_manager->_connection_attempts = 0;
        system_manager->wifi_connection = true;
    }
}